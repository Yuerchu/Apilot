import dagre from "@dagrejs/dagre"
import { buildSchemaGraph, type SchemaGraph, type SchemaGraphEdge, type SchemaGraphNode } from "@/lib/openapi/schema-graph"
import {
  MODEL_GRAPH_MAX_AUTO_LAYOUT_EDGES,
  MODEL_GRAPH_MAX_AUTO_LAYOUT_NODES,
  MODEL_GRAPH_MAX_FOCUSED_LAYOUT_EDGES,
  MODEL_GRAPH_MAX_FOCUSED_LAYOUT_NODES,
  MODEL_GRAPH_NODE_HEIGHT,
  MODEL_GRAPH_NODE_WIDTH,
  type ModelGraphComputedResult,
  type ModelGraphLayout,
  type ModelGraphLayoutEdge,
  type ModelGraphLayoutNode,
  type ModelGraphMetrics,
  type ModelGraphTooLargeResult,
  type ModelGraphWorkerMessage,
  type ModelGraphWorkerRequest,
} from "./model-graph-types"

interface SchemaGraphCache {
  graph: SchemaGraph
  results: Map<string, ModelGraphComputedResult>
}

interface WorkerContext {
  postMessage(message: ModelGraphWorkerMessage): void
  addEventListener(type: "message", listener: (event: MessageEvent<ModelGraphWorkerRequest>) => void): void
}

const ctx = self as unknown as WorkerContext
const schemaCaches = new Map<number, SchemaGraphCache>()

function postMessageToMain(message: ModelGraphWorkerMessage) {
  ctx.postMessage(message)
}

function postProgress(requestId: number, phase: "parsing" | "layout", metrics: ModelGraphMetrics) {
  postMessageToMain({
    type: "progress",
    requestId,
    phase,
    metrics,
  })
}

function getVisibleNames(graph: SchemaGraph, filter: string): Set<string> {
  const query = filter.trim().toLowerCase()
  if (!query) return new Set(graph.nodes.map(node => node.id))

  const visible = new Set(
    graph.nodes
      .filter(node => node.name.toLowerCase().includes(query) || node.type.toLowerCase().includes(query))
      .map(node => node.id),
  )

  for (const edge of graph.edges) {
    if (visible.has(edge.source) || visible.has(edge.target)) {
      visible.add(edge.source)
      visible.add(edge.target)
    }
  }

  return visible
}

function getFocusedNames(graph: SchemaGraph, focusModel: string, focusDepth: number): Set<string> {
  const visible = new Set<string>([focusModel])
  let frontier = new Set<string>([focusModel])
  const maxDepth = Math.max(1, focusDepth)

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const nextFrontier = new Set<string>()
    for (const edge of graph.edges) {
      if (frontier.has(edge.source) && !visible.has(edge.target)) {
        visible.add(edge.target)
        nextFrontier.add(edge.target)
      }
      if (frontier.has(edge.target) && !visible.has(edge.source)) {
        visible.add(edge.source)
        nextFrontier.add(edge.source)
      }
    }
    frontier = nextFrontier
    if (!frontier.size) break
  }

  return visible
}

function getConnectedNames(edges: ModelGraphLayoutEdge[]): Set<string> {
  const connected = new Set<string>()
  for (const edge of edges) {
    connected.add(edge.source)
    connected.add(edge.target)
  }
  return connected
}

function getRequestCacheKey(request: ModelGraphWorkerRequest): string {
  return request.focusModel
    ? `focus:${request.focusModel}:${request.focusDepth}`
    : `filter:${request.filter}`
}

function hashLayoutKey(cacheKey: string, nodes: SchemaGraphNode[], edges: SchemaGraphEdge[]): string {
  let hash = 2166136261
  const update = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
  }

  update(cacheKey)
  for (const node of nodes) update(node.id)
  for (const edge of edges) update(edge.id)

  return `${nodes.length}:${edges.length}:${(hash >>> 0).toString(36)}`
}

function getGraphCache(request: ModelGraphWorkerRequest): SchemaGraphCache {
  const cached = schemaCaches.get(request.schemaId)
  if (cached) return cached

  if (!request.schemas) {
    throw new Error("Schema graph is not initialized in the worker")
  }

  postProgress(request.requestId, "parsing", {
    schemaCount: request.schemaCount,
  })

  const cache: SchemaGraphCache = {
    graph: buildSchemaGraph(request.schemas),
    results: new Map(),
  }
  schemaCaches.set(request.schemaId, cache)
  return cache
}

function getTooLargeResult(
  filter: string,
  focusModel: string | undefined,
  metrics: Required<ModelGraphMetrics>,
): ModelGraphTooLargeResult | null {
  const isFocused = !!focusModel || filter.length > 0
  const limit = isFocused
    ? { nodes: MODEL_GRAPH_MAX_FOCUSED_LAYOUT_NODES, edges: MODEL_GRAPH_MAX_FOCUSED_LAYOUT_EDGES }
    : { nodes: MODEL_GRAPH_MAX_AUTO_LAYOUT_NODES, edges: MODEL_GRAPH_MAX_AUTO_LAYOUT_EDGES }

  if (metrics.visibleNodeCount <= limit.nodes && metrics.visibleEdgeCount <= limit.edges) {
    return null
  }

  return {
    status: "too-large",
    filter,
    ...(focusModel ? { focusModel } : {}),
    metrics,
    limit,
  }
}

function layoutGraph(
  graph: SchemaGraph,
  cacheKey: string,
  schemaCount: number,
  visibleGraphNodes: SchemaGraphNode[],
  visibleGraphEdges: SchemaGraphEdge[],
): ModelGraphLayout {
  const dagreGraph = new dagre.graphlib.Graph()
    .setDefaultEdgeLabel(() => ({}))
    .setGraph({
      rankdir: "LR",
      align: "UL",
      nodesep: 44,
      ranksep: 92,
      marginx: 24,
      marginy: 24,
    })

  for (const node of visibleGraphNodes) {
    dagreGraph.setNode(node.id, { width: MODEL_GRAPH_NODE_WIDTH, height: MODEL_GRAPH_NODE_HEIGHT })
  }

  for (const edge of visibleGraphEdges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }

  dagre.layout(dagreGraph)

  const edges: ModelGraphLayoutEdge[] = visibleGraphEdges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    kind: edge.kind,
  }))
  const connectedNames = getConnectedNames(edges)

  const nodes: ModelGraphLayoutNode[] = visibleGraphNodes.map(node => {
    const position = dagreGraph.node(node.id) as { x?: number; y?: number } | undefined
    return {
      id: node.id,
      type: "model",
      position: {
        x: (position?.x ?? 0) - MODEL_GRAPH_NODE_WIDTH / 2,
        y: (position?.y ?? 0) - MODEL_GRAPH_NODE_HEIGHT / 2,
      },
      draggable: false,
      selectable: false,
      data: {
        name: node.name,
        type: node.type,
        fieldCount: node.fieldCount,
        connected: !edges.length || connectedNames.has(node.name),
      },
    }
  })

  return {
    key: hashLayoutKey(cacheKey, visibleGraphNodes, visibleGraphEdges),
    schemaCount,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    visibleNodeCount: visibleGraphNodes.length,
    visibleEdgeCount: visibleGraphEdges.length,
    nodes,
    edges,
  }
}

function handleLayoutRequest(request: ModelGraphWorkerRequest) {
  const cache = getGraphCache(request)
  const cacheKey = getRequestCacheKey(request)
  const cachedResult = cache.results.get(cacheKey)
  if (cachedResult) {
    postMessageToMain({
      type: "result",
      requestId: request.requestId,
      result: cachedResult,
    })
    return
  }

  const visibleNames = request.focusModel
    ? getFocusedNames(cache.graph, request.focusModel, request.focusDepth)
    : getVisibleNames(cache.graph, request.filter)
  const visibleGraphNodes = cache.graph.nodes.filter(node => visibleNames.has(node.id))
  const visibleGraphEdges = cache.graph.edges.filter(edge => visibleNames.has(edge.source) && visibleNames.has(edge.target))
  const metrics: Required<ModelGraphMetrics> = {
    schemaCount: request.schemaCount,
    nodeCount: cache.graph.nodes.length,
    edgeCount: cache.graph.edges.length,
    visibleNodeCount: visibleGraphNodes.length,
    visibleEdgeCount: visibleGraphEdges.length,
  }

  postProgress(request.requestId, "layout", metrics)

  const tooLargeResult = getTooLargeResult(request.filter, request.focusModel, metrics)
  const result: ModelGraphComputedResult = tooLargeResult ?? {
    status: "ready",
    layout: layoutGraph(cache.graph, cacheKey, request.schemaCount, visibleGraphNodes, visibleGraphEdges),
  }

  cache.results.set(cacheKey, result)
  postMessageToMain({
    type: "result",
    requestId: request.requestId,
    result,
  })
}

ctx.addEventListener("message", (event: MessageEvent<ModelGraphWorkerRequest>) => {
  const request = event.data
  if (request.type !== "layout") return

  try {
    handleLayoutRequest(request)
  } catch (error) {
    postMessageToMain({
      type: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Unknown graph worker error",
    })
  }
})

export {}
