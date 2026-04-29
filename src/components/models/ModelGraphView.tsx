import { startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useTheme } from "next-themes"
import { Database } from "lucide-react"
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
import { getTypeStr } from "@/lib/openapi/type-str"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SchemaTree } from "@/components/schema/SchemaTree"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import ModelGraphWorker from "./model-graph.worker.ts?worker&inline"
import {
  MODEL_GRAPH_EDGE_KINDS,
  MODEL_GRAPH_FOCUS_DEPTH,
  MODEL_GRAPH_FOCUS_DEPTH_OPTIONS,
  MODEL_GRAPH_NODE_HEIGHT,
  MODEL_GRAPH_NODE_WIDTH,
} from "./model-graph-types"
import type {
  ModelGraphComputedResult,
  ModelGraphFocusDepth,
  ModelGraphLayout,
  ModelGraphLayoutEdge,
  ModelGraphLayoutNode,
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
  focused: boolean
  connected: boolean
}

type ModelFlowNode = Node<ModelNodeData, "model">
type ModelFlowEdge = Edge<Record<string, never>, "smoothstep">
type EnabledEdgeKinds = Record<SchemaGraphEdgeKind, boolean>

interface ModelRelationSummary {
  name: string
  label: string
  kind: SchemaGraphEdgeKind
}

interface GraphExportOptions {
  title: string
}

type GraphState =
  | {
      status: "loading"
      schemas: Record<string, SchemaObject>
      cacheKey: string
      phase: ModelGraphWorkerPhase
      metrics: ModelGraphMetrics
    }
  | {
      status: "result"
      schemas: Record<string, SchemaObject>
      cacheKey: string
      result: ModelGraphComputedResult
    }
  | {
      status: "error"
      schemas: Record<string, SchemaObject>
      cacheKey: string
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
        "relative w-[220px] cursor-pointer rounded-md border bg-card px-3 py-2 shadow-xs transition-colors",
        data.selected && "border-primary/60 bg-primary/5",
        data.focused && "border-primary bg-primary/10 ring-2 ring-primary/20",
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
  cacheKey: string,
): ModelGraphComputedResult | undefined {
  return graphResultCache.get(schemas)?.get(cacheKey)
}

function setCachedResult(
  schemas: Record<string, SchemaObject>,
  cacheKey: string,
  result: ModelGraphComputedResult,
) {
  let cache = graphResultCache.get(schemas)
  if (!cache) {
    cache = new Map()
    graphResultCache.set(schemas, cache)
  }
  cache.set(cacheKey, result)
}

const defaultEnabledEdgeKinds: EnabledEdgeKinds = {
  extends: true,
  variant: true,
  references: true,
}

function getGraphCacheKey(
  filter: string,
  focusedModel: string | null,
  focusDepth: ModelGraphFocusDepth,
  edgeKinds: readonly SchemaGraphEdgeKind[],
): string {
  const edgeKindsKey = edgeKinds.join(",") || "none"
  return focusedModel
    ? `edges:${edgeKindsKey}:focus:${focusedModel}:${focusDepth}`
    : `edges:${edgeKindsKey}:filter:${filter}`
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

function resolveColor(cssVar: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  if (!value) return fallback
  // OKLCH values need conversion for SVG — wrap in CSS color()
  if (value.startsWith("oklch")) return fallback
  return value
}

function getStaticEdgeColor(kind: SchemaGraphEdgeKind): string {
  if (kind === "extends") return resolveColor("--color-primary", "#e8e8e8")
  if (kind === "variant") return resolveColor("--color-method-put", "#bba7ff")
  return resolveColor("--color-muted-foreground", "#9ca3af")
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, "'").replace(/\n/g, " ")
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .filter(char => char.charCodeAt(0) >= 32)
    .join("")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
  return sanitized || "model-graph"
}

function getLayoutBounds(nodes: ModelGraphLayoutNode[]) {
  if (!nodes.length) {
    return { minX: 0, minY: 0, maxX: MODEL_GRAPH_NODE_WIDTH, maxY: MODEL_GRAPH_NODE_HEIGHT }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + MODEL_GRAPH_NODE_WIDTH)
    maxY = Math.max(maxY, node.position.y + MODEL_GRAPH_NODE_HEIGHT)
  }

  return { minX, minY, maxX, maxY }
}

function makeGraphSvg(layout: ModelGraphLayout, options: GraphExportOptions): string {
  const padding = 48
  const bounds = getLayoutBounds(layout.nodes)
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2)
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2)
  const offsetX = padding - bounds.minX
  const offsetY = padding - bounds.minY
  const nodeById = new Map(layout.nodes.map(node => [node.id, node]))

  const edges = layout.edges.map(edge => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) return ""

    const sourceX = source.position.x + offsetX + MODEL_GRAPH_NODE_WIDTH
    const sourceY = source.position.y + offsetY + MODEL_GRAPH_NODE_HEIGHT / 2
    const targetX = target.position.x + offsetX
    const targetY = target.position.y + offsetY + MODEL_GRAPH_NODE_HEIGHT / 2
    const midX = sourceX + (targetX - sourceX) / 2
    const color = getStaticEdgeColor(edge.kind)
    const labelX = (sourceX + targetX) / 2
    const labelY = (sourceY + targetY) / 2 - 6
    const label = truncate(edge.label, 28)

    return `
      <path d="M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}" fill="none" stroke="${color}" stroke-width="1.4" marker-end="url(#arrow-${edge.kind})" opacity="0.9" />
      ${label ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#a3a3a3" font-size="10" font-family="ui-monospace, monospace">${escapeXml(label)}</text>` : ""}`
  }).join("")

  const nodes = layout.nodes.map(node => {
    const x = node.position.x + offsetX
    const y = node.position.y + offsetY
    const name = truncate(node.data.name, 26)
    const type = truncate(node.data.type, 32)

    const fillCard = resolveColor("--color-card", "#171717")
    const strokeBorder = resolveColor("--color-border", "#3f3f46")
    const fillFg = resolveColor("--color-foreground", "#f4f4f5")
    const fillMuted = resolveColor("--color-muted-foreground", "#a1a1aa")
    const fillSecondary = resolveColor("--color-secondary-foreground", "#d4d4d8")

    return `
      <g>
        <rect x="${x}" y="${y}" width="${MODEL_GRAPH_NODE_WIDTH}" height="${MODEL_GRAPH_NODE_HEIGHT}" rx="6" fill="${fillCard}" stroke="${strokeBorder}" stroke-width="1" />
        <text x="${x + 14}" y="${y + 25}" fill="${fillFg}" font-size="14" font-weight="600" font-family="ui-monospace, monospace">${escapeXml(name)}</text>
        <text x="${x + 14}" y="${y + 45}" fill="${fillMuted}" font-size="11" font-family="system-ui, sans-serif">${escapeXml(type)}</text>
        <text x="${x + 14}" y="${y + 65}" fill="${fillSecondary}" font-size="10" font-family="system-ui, sans-serif">${node.data.fieldCount} fields</text>
      </g>`
  }).join("")

  const bgColor = resolveColor("--color-background", "#0f0f10")
  const fgColor = resolveColor("--color-foreground", "#f4f4f5")
  const mutedColor = resolveColor("--color-muted-foreground", "#a1a1aa")

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(options.title)}">
  <defs>
    ${MODEL_GRAPH_EDGE_KINDS.map(kind => {
      const color = getStaticEdgeColor(kind)
      return `<marker id="arrow-${kind}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 3 L 0 6 z" fill="${color}" /></marker>`
    }).join("")}
  </defs>
  <rect width="100%" height="100%" fill="${bgColor}" />
  <text x="24" y="30" fill="${fgColor}" font-size="14" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(options.title)}</text>
  <text x="24" y="50" fill="${mutedColor}" font-size="11" font-family="system-ui, sans-serif">${layout.visibleNodeCount} models / ${layout.visibleEdgeCount} relations</text>
  <g transform="translate(0, 24)">
    ${edges}
    ${nodes}
  </g>
</svg>`
}

function makeMermaid(layout: ModelGraphLayout): string {
  const nodeIds = new Map(layout.nodes.map((node, index) => [node.id, `n${index}`]))
  const lines = ["flowchart LR"]

  for (const node of layout.nodes) {
    const id = nodeIds.get(node.id)
    if (!id) continue
    lines.push(`  ${id}["${escapeMermaidLabel(node.data.name)}"]`)
  }

  for (const edge of layout.edges) {
    const source = nodeIds.get(edge.source)
    const target = nodeIds.get(edge.target)
    if (!source || !target) continue
    const label = escapeMermaidLabel(edge.label || edge.kind)
    lines.push(`  ${source} -->|"${label}"| ${target}`)
  }

  return `${lines.join("\n")}\n`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function downloadText(content: string, filename: string, type: string) {
  downloadBlob(new Blob([content], { type }), filename)
}

async function downloadPngFromSvg(svg: string, filename: string): Promise<void> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(svgBlob)

  try {
    const image = new Image()
    image.decoding = "async"
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Could not render SVG"))
    })
    image.src = url
    await loaded

    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas is not available")
    context.drawImage(image, 0, 0)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) resolve(result)
        else reject(new Error("Could not create PNG"))
      }, "image/png")
    })
    downloadBlob(blob, filename)
  } finally {
    URL.revokeObjectURL(url)
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

function getEdgeKindLabel(t: ReturnType<typeof useTranslation>["t"], kind: SchemaGraphEdgeKind): string {
  if (kind === "extends") return t("models.edgeExtends", "Inheritance")
  if (kind === "variant") return t("models.edgeVariant", "Union")
  return t("models.edgeReferences", "References")
}

function GraphOptionsBar({
  focusedModel,
  enabledEdgeKinds,
  focusDepth,
  canExport,
  onToggleEdgeKind,
  onFocusDepthChange,
  onClearFocus,
  onExportSvg,
  onExportPng,
  onCopyMermaid,
}: {
  focusedModel: string | null
  enabledEdgeKinds: EnabledEdgeKinds
  focusDepth: ModelGraphFocusDepth
  canExport: boolean
  onToggleEdgeKind: (kind: SchemaGraphEdgeKind) => void
  onFocusDepthChange: (depth: ModelGraphFocusDepth) => void
  onClearFocus: () => void
  onExportSvg: () => void
  onExportPng: () => void
  onCopyMermaid: () => void
}) {
  const { t } = useTranslation()
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const handleExportAction = (action: () => void) => {
    setExportMenuOpen(false)
    action()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-2 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="px-1 text-xs text-muted-foreground">
          {t("models.relationTypes", "Relations")}
        </span>
        {MODEL_GRAPH_EDGE_KINDS.map(kind => (
          <Button
            key={kind}
            type="button"
            variant={enabledEdgeKinds[kind] ? "secondary" : "ghost"}
            size="xs"
            onClick={() => onToggleEdgeKind(kind)}
          >
            {getEdgeKindLabel(t, kind)}
          </Button>
        ))}
      </div>

      {focusedModel && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="max-w-[220px] truncate px-1 font-mono text-xs text-muted-foreground" title={focusedModel}>
            {focusedModel}
          </span>
          <span className="px-1 text-xs text-muted-foreground">
            {t("models.focusDepth", "Depth")}
          </span>
          {MODEL_GRAPH_FOCUS_DEPTH_OPTIONS.map(depth => (
            <Button
              key={depth}
              type="button"
              variant={focusDepth === depth ? "secondary" : "ghost"}
              size="xs"
              onClick={() => onFocusDepthChange(depth)}
            >
              {depth}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="xs" onClick={onClearFocus}>
            {t("models.showFullGraph", "Full graph")}
          </Button>
        </div>
      )}

      <Popover
        open={canExport && exportMenuOpen}
        onOpenChange={open => setExportMenuOpen(canExport && open)}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="xs" disabled={!canExport}>
            {t("models.exportGraph", "Export")}
            <span aria-hidden className="size-0 border-x-[3px] border-t-[4px] border-x-transparent border-t-current" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-32 p-1">
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="w-full justify-start"
              onClick={() => handleExportAction(onExportSvg)}
            >
              SVG
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="w-full justify-start"
              onClick={() => handleExportAction(onExportPng)}
            >
              PNG
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="w-full justify-start"
              onClick={() => handleExportAction(onCopyMermaid)}
            >
              Mermaid
            </Button>
          </div>
        </PopoverContent>
      </Popover>
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
  const hasScope = result.filter.length > 0 || !!result.focusModel

  return (
    <GraphStatusShell>
      <div className="rounded-md border bg-secondary/60 px-2.5 py-1.5 text-xs font-medium text-secondary-foreground">
        {t("models.graphTooLargeBadge", "Large graph")}
      </div>
      <div className="max-w-2xl">
        <div className="text-sm font-medium text-foreground">
          {hasScope
            ? t("models.graphFilteredTooLarge", "This focused graph is still large")
            : t("models.graphTooLarge", "This graph is too large to draw automatically")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {hasScope
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

function getModelRelations(edges: ModelGraphLayoutEdge[], modelName: string): {
  outgoing: ModelRelationSummary[]
  incoming: ModelRelationSummary[]
} {
  const outgoing: ModelRelationSummary[] = []
  const incoming: ModelRelationSummary[] = []

  for (const edge of edges) {
    if (edge.source === modelName) {
      outgoing.push({ name: edge.target, label: edge.label, kind: edge.kind })
    } else if (edge.target === modelName) {
      incoming.push({ name: edge.source, label: edge.label, kind: edge.kind })
    }
  }

  return { outgoing, incoming }
}

function RelationList({
  title,
  relations,
  onFocusModel,
}: {
  title: string
  relations: ModelRelationSummary[]
  onFocusModel: (name: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      {relations.length ? (
        <div className="flex min-w-0 max-w-full flex-col gap-1.5">
          {relations.map(relation => (
            <button
              key={`${relation.kind}:${relation.name}:${relation.label}`}
              type="button"
              className="flex w-full min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden rounded-md border bg-background px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/50"
              onClick={() => onFocusModel(relation.name)}
              title={`${relation.name} (${relation.kind})`}
            >
              <span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-foreground">
                {relation.name}
              </span>
              <Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 text-[10px]">
                {relation.kind}
              </Badge>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border bg-background px-2 py-2 text-xs text-muted-foreground">
          {t("models.noGraphRelations", "No relations")}
        </div>
      )}
    </div>
  )
}

function ModelDetailsPanel({
  modelName,
  schema,
  routeCount,
  outgoing,
  incoming,
  onClearFocus,
  onFocusModel,
}: {
  modelName: string
  schema: SchemaObject
  routeCount: number
  outgoing: ModelRelationSummary[]
  incoming: ModelRelationSummary[]
  onClearFocus: () => void
  onFocusModel: (name: string) => void
}) {
  const { t } = useTranslation()
  const effectiveSchema = useMemo(() => resolveEffectiveSchema(schema), [schema])
  const typeStr = useMemo(() => getTypeStr(schema), [schema])
  const fieldCount = Object.keys(effectiveSchema.properties || {}).length
  const requiredCount = effectiveSchema.required?.length ?? 0
  const description = schema.description || schema.title

  return (
    <aside className="max-h-[min(70vh,760px)] w-full overflow-x-hidden overflow-y-auto rounded-lg border bg-card p-3 xl:max-h-none xl:w-[360px] xl:max-w-[36%] xl:self-stretch">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{t("models.modelDetails", "Model details")}</div>
          <div className="mt-1 truncate font-mono text-sm font-semibold text-foreground" title={modelName}>
            {modelName}
          </div>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={onClearFocus}>
          {t("models.clearFocus", "Clear")}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="rounded-md font-mono text-[10px]">
          {typeStr}
        </Badge>
        <Badge variant="outline" className="rounded-md text-[10px]">
          {t("models.fields", { count: fieldCount, defaultValue: `${fieldCount} fields` })}
        </Badge>
        <Badge variant="outline" className="rounded-md text-[10px]">
          {t("models.requiredFields", { count: requiredCount, defaultValue: `${requiredCount} required` })}
        </Badge>
        <Badge variant="outline" className="rounded-md text-[10px]">
          {t("models.routes", { count: routeCount, defaultValue: `${routeCount} routes` })}
        </Badge>
      </div>

      <div className="mt-3 break-words rounded-md border bg-background p-2 text-xs text-muted-foreground">
        {description || t("models.noDescription", "No description")}
      </div>

      <div className="mt-3 grid gap-3">
        <RelationList
          title={t("models.references", "References")}
          relations={outgoing}
          onFocusModel={onFocusModel}
        />
        <RelationList
          title={t("models.referencedBy", "Referenced by")}
          relations={incoming}
          onFocusModel={onFocusModel}
        />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          {t("models.schemaPreview", "Schema")}
        </div>
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[520px]">
            <SchemaTree schema={schema} maxDepth={4} />
          </div>
        </div>
      </div>
    </aside>
  )
}

function getCurrentResult(
  cachedResult: ModelGraphComputedResult | undefined,
  state: GraphState,
  schemas: Record<string, SchemaObject>,
  cacheKey: string,
): ModelGraphComputedResult | null {
  if (cachedResult) return cachedResult
  if (state.status !== "result") return null
  return state.schemas === schemas && state.cacheKey === cacheKey ? state.result : null
}

function getCurrentError(
  state: GraphState,
  schemas: Record<string, SchemaObject>,
  cacheKey: string,
): string | null {
  if (state.status !== "error") return null
  return state.schemas === schemas && state.cacheKey === cacheKey ? state.message : null
}

function getCurrentLoading(
  state: GraphState,
  schemas: Record<string, SchemaObject>,
  cacheKey: string,
  schemaCount: number,
): Extract<GraphState, { status: "loading" }> {
  if (state.status === "loading" && state.schemas === schemas && state.cacheKey === cacheKey) {
    return state
  }

  return {
    status: "loading",
    schemas,
    cacheKey,
    phase: "queued",
    metrics: { schemaCount },
  }
}

function useWorkerGraphResult(
  schemas: Record<string, SchemaObject>,
  filter: string,
  schemaCount: number,
  focusedModel: string | null,
  focusDepth: ModelGraphFocusDepth,
  edgeKinds: readonly SchemaGraphEdgeKind[],
) {
  const cacheKey = getGraphCacheKey(filter, focusedModel, focusDepth, edgeKinds)
  const [graphState, setGraphState] = useState<GraphState>({
    status: "loading",
    schemas,
    cacheKey,
    phase: "queued",
    metrics: { schemaCount },
  })

  useEffect(() => {
    if (getCachedResult(schemas, cacheKey)) return

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
            cacheKey,
            phase: message.phase,
            metrics: message.metrics,
          })
        })
        return
      }

      if (message.type === "result") {
        initializedSchemaIds.add(schemaId)
        setCachedResult(schemas, cacheKey, message.result)

        startTransition(() => {
          setGraphState({
            status: "result",
            schemas,
            cacheKey,
            result: message.result,
          })
        })
        return
      }

      startTransition(() => {
        setGraphState({
          status: "error",
          schemas,
          cacheKey,
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
          cacheKey,
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
      focusDepth,
      edgeKinds: [...edgeKinds],
    }

    if (focusedModel) {
      request.focusModel = focusedModel
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
  }, [schemas, filter, schemaCount, focusedModel, focusDepth, edgeKinds, cacheKey])

  const cachedResult = getCachedResult(schemas, cacheKey)
  const currentResult = getCurrentResult(cachedResult, graphState, schemas, cacheKey)
  const currentError = currentResult ? null : getCurrentError(graphState, schemas, cacheKey)
  const currentLoading = currentResult || currentError
    ? null
    : getCurrentLoading(graphState, schemas, cacheKey, schemaCount)

  return {
    result: currentResult,
    error: currentError,
    loading: currentLoading,
  }
}

export function ModelGraphView({ schemas, filter, selectedModels, modelRouteMap }: ModelGraphViewProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { state, setActiveModelName } = useOpenAPIContext()
  const [focusDepth, setFocusDepth] = useState<ModelGraphFocusDepth>(MODEL_GRAPH_FOCUS_DEPTH)
  const [enabledEdgeKinds, setEnabledEdgeKinds] = useState<EnabledEdgeKinds>(defaultEnabledEdgeKinds)
  const normalizedFilter = filter.trim().toLowerCase()
  const schemaCount = useMemo(() => Object.keys(schemas).length, [schemas])
  const activeFocusedModel = state.activeModelName && schemas[state.activeModelName] ? state.activeModelName : null
  const enabledEdgeKindList = useMemo(
    () => MODEL_GRAPH_EDGE_KINDS.filter(kind => enabledEdgeKinds[kind]),
    [enabledEdgeKinds],
  )
  const { result, error, loading } = useWorkerGraphResult(
    schemas,
    normalizedFilter,
    schemaCount,
    activeFocusedModel,
    focusDepth,
    enabledEdgeKindList,
  )

  const layout = result?.status === "ready" ? result.layout : null
  const tooLargeResult = result?.status === "too-large" ? result : null
  const focusedSchema = activeFocusedModel ? schemas[activeFocusedModel] : undefined
  const focusedRelations = useMemo(
    () => activeFocusedModel && layout ? getModelRelations(layout.edges, activeFocusedModel) : { outgoing: [], incoming: [] },
    [activeFocusedModel, layout],
  )
  const handleClearFocus = useCallback(() => {
    setActiveModelName("")
  }, [setActiveModelName])
  const handleFocusModel = useCallback((name: string) => {
    setActiveModelName(name)
  }, [setActiveModelName])
  const handleToggleEdgeKind = useCallback((kind: SchemaGraphEdgeKind) => {
    setEnabledEdgeKinds(current => ({
      ...current,
      [kind]: !current[kind],
    }))
  }, [])
  const handleFocusDepthChange = useCallback((depth: ModelGraphFocusDepth) => {
    setFocusDepth(depth)
  }, [])
  const exportTitle = activeFocusedModel
    ? `Model graph: ${activeFocusedModel}`
    : normalizedFilter
      ? `Model graph: ${normalizedFilter}`
      : "Model graph"
  const exportFileBase = sanitizeFileName(
    activeFocusedModel
      ? `model-graph-${activeFocusedModel}`
      : normalizedFilter
        ? `model-graph-${normalizedFilter}`
        : "model-graph",
  )
  const handleExportSvg = useCallback(() => {
    if (!layout) return
    const svg = makeGraphSvg(layout, { title: exportTitle })
    downloadText(svg, `${exportFileBase}.svg`, "image/svg+xml;charset=utf-8")
    toast.success(t("toast.graphSvgExported", "SVG exported"))
  }, [exportFileBase, exportTitle, layout, t])
  const handleExportPng = useCallback(() => {
    if (!layout) return
    const svg = makeGraphSvg(layout, { title: exportTitle })
    void downloadPngFromSvg(svg, `${exportFileBase}.png`)
      .then(() => toast.success(t("toast.graphPngExported", "PNG exported")))
      .catch(() => toast.error(t("toast.graphExportFailed", "Graph export failed")))
  }, [exportFileBase, exportTitle, layout, t])
  const handleCopyMermaid = useCallback(() => {
    if (!layout) return
    navigator.clipboard.writeText(makeMermaid(layout))
      .then(() => toast.success(t("toast.graphMermaidCopied", "Mermaid copied")))
      .catch(() => toast.error(t("toast.graphExportFailed", "Graph export failed")))
  }, [layout, t])

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
          focused: activeFocusedModel === data.name,
        },
      }
    }),
    [activeFocusedModel, layout, modelRouteMap, selectedModels],
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
      <Empty className="mb-4 min-h-[420px] rounded-lg border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Database className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{filter ? t("models.noMatch") : t("models.noModels")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="mb-4 flex min-h-[420px] flex-1 flex-col gap-3 xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <GraphOptionsBar
          focusedModel={activeFocusedModel}
          enabledEdgeKinds={enabledEdgeKinds}
          focusDepth={focusDepth}
          canExport={!!layout}
          onToggleEdgeKind={handleToggleEdgeKind}
          onFocusDepthChange={handleFocusDepthChange}
          onClearFocus={handleClearFocus}
          onExportSvg={handleExportSvg}
          onExportPng={handleExportPng}
          onCopyMermaid={handleCopyMermaid}
        />
        <div className="min-h-[420px] min-w-0 flex-1 overflow-hidden rounded-lg border bg-card">
          <ReactFlow
            key={flowKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode={resolvedTheme === "light" ? "light" : "dark"}
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
            onNodeClick={(_, node) => setActiveModelName(node.data.name)}
          >
            <Background color="var(--color-border)" gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>

      {activeFocusedModel && focusedSchema && (
        <ModelDetailsPanel
          modelName={activeFocusedModel}
          schema={focusedSchema}
          routeCount={modelRouteMap.modelToRoutes[activeFocusedModel]?.length ?? 0}
          outgoing={focusedRelations.outgoing}
          incoming={focusedRelations.incoming}
          onClearFocus={handleClearFocus}
          onFocusModel={handleFocusModel}
        />
      )}
    </div>
  )
}
