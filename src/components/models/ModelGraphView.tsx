import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { ModelRouteMap, SchemaObject } from "@/lib/openapi/types"
import type { SchemaGraphEdgeKind } from "@/lib/openapi/schema-graph"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import ModelGraphWorker from "./model-graph.worker.ts?worker&inline"
import type {
  ModelGraphComputedResult,
  ModelGraphLayoutEdge,
  ModelGraphMetrics,
  ModelGraphTooLargeResult,
  ModelGraphWorkerMessage,
  ModelGraphWorkerPhase,
  ModelGraphWorkerRequest,
} from "./model-graph-types"

interface ModelGraphViewProps {
  schemas: Record<string, SchemaObject>
  filter: string
  selectedModels: Set<string>
  modelRouteMap: ModelRouteMap
}

interface ModelNodeData extends Record<string, unknown> {
  name: string
  type: string
  fieldCount: number
  routeCount: number
  selected: boolean
  connected: boolean
}

type ModelFlowNode = Node<ModelNodeData, "model">
type ModelFlowEdge = Edge<Record<string, never>, "smoothstep">

type GraphState =
  | {
      status: "loading"
      schemas: Record<string, SchemaObject>
      filter: string
      phase: ModelGraphWorkerPhase
      metrics: ModelGraphMetrics
    }
  | {
      status: "result"
      schemas: Record<string, SchemaObject>
      filter: string
      result: ModelGraphComputedResult
    }
  | {
      status: "error"
      schemas: Record<string, SchemaObject>
      filter: string
      message: string
    }

let modelGraphWorker: Worker | null = null
let nextRequestId = 1
let nextSchemaId = 1
const schemaIds = new WeakMap<Record<string, SchemaObject>, number>()
const initializedSchemaIds = new Set<number>()
const graphResultCache = new WeakMap<Record<string, SchemaObject>, Map<string, ModelGraphComputedResult>>()

function ModelNode({ data }: NodeProps<ModelFlowNode>) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        "relative w-[220px] rounded-md border bg-card px-3 py-2 shadow-xs",
        data.selected && "border-primary/60 bg-primary/5",
        !data.connected && "opacity-80",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="size-2 border-border bg-background opacity-0"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="size-2 border-border bg-background opacity-0"
        isConnectable={false}
      />
      <div className="truncate font-mono text-sm font-semibold text-foreground" title={data.name}>
        {data.name}
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground" title={data.type}>
        {data.type}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px]">
          {t("models.fields", { count: data.fieldCount, defaultValue: `${data.fieldCount} fields` })}
        </Badge>
        {data.routeCount > 0 && (
          <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">
            {t("models.routes", { count: data.routeCount, defaultValue: `${data.routeCount} routes` })}
          </Badge>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  model: ModelNode,
} satisfies NodeTypes

function getModelGraphWorker(): Worker {
  modelGraphWorker ??= new ModelGraphWorker({ name: "model-graph-layout" })
  return modelGraphWorker
}

function getSchemaId(schemas: Record<string, SchemaObject>): number {
  const cachedId = schemaIds.get(schemas)
  if (cachedId) return cachedId

  const schemaId = nextSchemaId
  nextSchemaId += 1
  schemaIds.set(schemas, schemaId)
  return schemaId
}

function getCachedResult(
  schemas: Record<string, SchemaObject>,
  filter: string,
): ModelGraphComputedResult | undefined {
  return graphResultCache.get(schemas)?.get(filter)
}

function setCachedResult(
  schemas: Record<string, SchemaObject>,
  filter: string,
  result: ModelGraphComputedResult,
) {
  let cache = graphResultCache.get(schemas)
  if (!cache) {
    cache = new Map()
    graphResultCache.set(schemas, cache)
  }
  cache.set(filter, result)
}

function getEdgeColor(kind: SchemaGraphEdgeKind): string {
  if (kind === "extends") return "var(--color-primary)"
  if (kind === "variant") return "var(--color-method-put)"
  return "var(--color-muted-foreground)"
}

function toFlowEdge(edge: ModelGraphLayoutEdge): ModelFlowEdge {
  const color = getEdgeColor(edge.kind)
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.label,
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeWidth: edge.kind === "extends" ? 1.8 : 1.2 },
    labelStyle: { fill: "var(--color-muted-foreground)", fontSize: 10 },
    labelBgStyle: { fill: "var(--color-card)" },
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 4,
  }
}

function formatCount(value: number | undefined): string {
  return value === undefined ? "-" : value.toLocaleString()
}

function MetricItem({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm text-foreground">{formatCount(value)}</div>
    </div>
  )
}

function GraphLoadingState({ phase, metrics }: { phase: ModelGraphWorkerPhase; metrics: ModelGraphMetrics }) {
  const { t } = useTranslation()
  const title =
    phase === "layout"
      ? t("models.graphLayoutLoading", "Laying out graph")
      : t("models.graphLoading", "Building graph")

  return (
    <GraphStatusShell>
      <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-secondary/60">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/35 border-t-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
      </div>
      <div className="grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricItem label={t("models.graphSchemas", "Schemas")} value={metrics.schemaCount} />
        <MetricItem label={t("models.graphRelations", "Relations")} value={metrics.edgeCount} />
        <MetricItem label={t("models.graphVisibleModels", "Visible")} value={metrics.visibleNodeCount} />
        <MetricItem label={t("models.graphVisibleRelations", "Visible edges")} value={metrics.visibleEdgeCount} />
      </div>
    </GraphStatusShell>
  )
}

function GraphTooLargeState({ result }: { result: ModelGraphTooLargeResult }) {
  const { t } = useTranslation()
  const hasFilter = result.filter.length > 0

  return (
    <GraphStatusShell>
      <div className="rounded-md border bg-secondary/60 px-2.5 py-1.5 text-xs font-medium text-secondary-foreground">
        {t("models.graphTooLargeBadge", "Large graph")}
      </div>
      <div className="max-w-2xl">
        <div className="text-sm font-medium text-foreground">
          {hasFilter
            ? t("models.graphFilteredTooLarge", "This focused graph is still large")
            : t("models.graphTooLarge", "This graph is too large to draw automatically")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {hasFilter
            ? t("models.graphFilteredTooLargeHint", "Use a more specific search term to narrow the model neighborhood.")
            : t("models.graphTooLargeHint", "Search for a model name above to render a smaller neighborhood first.")}
        </div>
      </div>
      <div className="grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricItem label={t("models.graphSchemas", "Schemas")} value={result.metrics.schemaCount} />
        <MetricItem label={t("models.graphRelations", "Relations")} value={result.metrics.edgeCount} />
        <MetricItem label={t("models.graphVisibleModels", "Visible")} value={result.metrics.visibleNodeCount} />
        <MetricItem label={t("models.graphVisibleRelations", "Visible edges")} value={result.metrics.visibleEdgeCount} />
      </div>
      <div className="text-[11px] text-muted-foreground">
        {t("models.graphTooLargeLimit", {
          defaultValue: "Current auto-layout limit: {{nodes}} models / {{edges}} relations",
          nodes: result.limit.nodes,
          edges: result.limit.edges,
        })}
      </div>
    </GraphStatusShell>
  )
}

function GraphErrorState({ message }: { message: string }) {
  const { t } = useTranslation()

  return (
    <GraphStatusShell>
      <div className="text-sm font-medium text-foreground">
        {t("models.graphError", "Could not build graph")}
      </div>
      <div className="max-w-2xl break-words font-mono text-xs text-muted-foreground">{message}</div>
    </GraphStatusShell>
  )
}

function GraphStatusShell({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex min-h-[420px] flex-1 flex-col items-center justify-center gap-4 rounded-lg border bg-card p-6 text-center">
      {children}
    </div>
  )
}

function getCurrentResult(
  cachedResult: ModelGraphComputedResult | undefined,
  state: GraphState,
  schemas: Record<string, SchemaObject>,
  filter: string,
): ModelGraphComputedResult | null {
  if (cachedResult) return cachedResult
  if (state.status !== "result") return null
  return state.schemas === schemas && state.filter === filter ? state.result : null
}

function getCurrentError(
  state: GraphState,
  schemas: Record<string, SchemaObject>,
  filter: string,
): string | null {
  if (state.status !== "error") return null
  return state.schemas === schemas && state.filter === filter ? state.message : null
}

function getCurrentLoading(
  state: GraphState,
  schemas: Record<string, SchemaObject>,
  filter: string,
  schemaCount: number,
): Extract<GraphState, { status: "loading" }> {
  if (state.status === "loading" && state.schemas === schemas && state.filter === filter) {
    return state
  }

  return {
    status: "loading",
    schemas,
    filter,
    phase: "queued",
    metrics: { schemaCount },
  }
}

function useWorkerGraphResult(
  schemas: Record<string, SchemaObject>,
  filter: string,
  schemaCount: number,
) {
  const [graphState, setGraphState] = useState<GraphState>({
    status: "loading",
    schemas,
    filter,
    phase: "queued",
    metrics: { schemaCount },
  })

  useEffect(() => {
    if (getCachedResult(schemas, filter)) return

    let active = true
    const worker = getModelGraphWorker()
    const requestId = nextRequestId
    nextRequestId += 1
    const schemaId = getSchemaId(schemas)

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as ModelGraphWorkerMessage
      if (!active || message.requestId !== requestId) return

      if (message.type === "progress") {
        if (message.phase === "layout") {
          initializedSchemaIds.add(schemaId)
        }

        startTransition(() => {
          setGraphState({
            status: "loading",
            schemas,
            filter,
            phase: message.phase,
            metrics: message.metrics,
          })
        })
        return
      }

      if (message.type === "result") {
        initializedSchemaIds.add(schemaId)
        setCachedResult(schemas, filter, message.result)

        startTransition(() => {
          setGraphState({
            status: "result",
            schemas,
            filter,
            result: message.result,
          })
        })
        return
      }

      startTransition(() => {
        setGraphState({
          status: "error",
          schemas,
          filter,
          message: message.message,
        })
      })
    }

    const handleError = (event: ErrorEvent) => {
      if (!active) return
      startTransition(() => {
        setGraphState({
          status: "error",
          schemas,
          filter,
          message: event.message || "Graph worker failed",
        })
      })
    }

    worker.addEventListener("message", handleMessage)
    worker.addEventListener("error", handleError)

    const request: ModelGraphWorkerRequest = {
      type: "layout",
      requestId,
      schemaId,
      schemaCount,
      filter,
    }

    if (!initializedSchemaIds.has(schemaId)) {
      request.schemas = schemas
    }

    worker.postMessage(request)

    return () => {
      active = false
      worker.removeEventListener("message", handleMessage)
      worker.removeEventListener("error", handleError)
    }
  }, [schemas, filter, schemaCount])

  const cachedResult = getCachedResult(schemas, filter)
  const currentResult = getCurrentResult(cachedResult, graphState, schemas, filter)
  const currentError = currentResult ? null : getCurrentError(graphState, schemas, filter)
  const currentLoading = currentResult || currentError
    ? null
    : getCurrentLoading(graphState, schemas, filter, schemaCount)

  return {
    result: currentResult,
    error: currentError,
    loading: currentLoading,
  }
}

export function ModelGraphView({ schemas, filter, selectedModels, modelRouteMap }: ModelGraphViewProps) {
  const { t } = useTranslation()
  const normalizedFilter = filter.trim().toLowerCase()
  const schemaCount = useMemo(() => Object.keys(schemas).length, [schemas])
  const { result, error, loading } = useWorkerGraphResult(schemas, normalizedFilter, schemaCount)

  const layout = result?.status === "ready" ? result.layout : null
  const tooLargeResult = result?.status === "too-large" ? result : null

  const nodes = useMemo<ModelFlowNode[]>(
    () => (layout?.nodes ?? []).map(node => {
      const { data, ...nodeProps } = node
      return {
        ...nodeProps,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          ...data,
          routeCount: modelRouteMap.modelToRoutes[data.name]?.length ?? 0,
          selected: selectedModels.has(data.name),
        },
      }
    }),
    [layout, modelRouteMap, selectedModels],
  )
  const edges = useMemo<ModelFlowEdge[]>(
    () => (layout?.edges ?? []).map(toFlowEdge),
    [layout],
  )
  const flowKey = layout?.key ?? "loading"

  if (loading) {
    return <GraphLoadingState phase={loading.phase} metrics={loading.metrics} />
  }

  if (error) {
    return <GraphErrorState message={error} />
  }

  if (tooLargeResult) {
    return <GraphTooLargeState result={tooLargeResult} />
  }

  if (!nodes.length) {
    return (
      <div className="mb-4 flex min-h-[420px] flex-1 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        {filter ? t("models.noMatch") : t("models.noModels")}
      </div>
    )
  }

  return (
    <div className="mb-4 min-h-[420px] flex-1 overflow-hidden rounded-lg border bg-card">
      <ReactFlow
        key={flowKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        style={{ background: "var(--color-card)" }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--color-border)" gap={18} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
