import type { SchemaGraphEdgeKind } from "@/lib/openapi/schema-graph"
import type { SchemaObject } from "@/lib/openapi/types"

export const MODEL_GRAPH_NODE_WIDTH = 220
export const MODEL_GRAPH_NODE_HEIGHT = 78
export const MODEL_GRAPH_MAX_AUTO_LAYOUT_NODES = 1200
export const MODEL_GRAPH_MAX_AUTO_LAYOUT_EDGES = 2400
export const MODEL_GRAPH_MAX_FOCUSED_LAYOUT_NODES = 1800
export const MODEL_GRAPH_MAX_FOCUSED_LAYOUT_EDGES = 3600

export type ModelGraphWorkerPhase = "queued" | "parsing" | "layout"

export interface ModelGraphMetrics {
  schemaCount: number
  nodeCount?: number
  edgeCount?: number
  visibleNodeCount?: number
  visibleEdgeCount?: number
}

export interface ModelGraphLayoutNodeData {
  name: string
  type: string
  fieldCount: number
  connected: boolean
}

export interface ModelGraphLayoutNode {
  id: string
  type: "model"
  position: {
    x: number
    y: number
  }
  draggable: false
  selectable: false
  data: ModelGraphLayoutNodeData
}

export interface ModelGraphLayoutEdge {
  id: string
  source: string
  target: string
  label: string
  kind: SchemaGraphEdgeKind
}

export interface ModelGraphLayout {
  key: string
  schemaCount: number
  nodeCount: number
  edgeCount: number
  visibleNodeCount: number
  visibleEdgeCount: number
  nodes: ModelGraphLayoutNode[]
  edges: ModelGraphLayoutEdge[]
}

export interface ModelGraphTooLargeResult {
  status: "too-large"
  filter: string
  metrics: Required<ModelGraphMetrics>
  limit: {
    nodes: number
    edges: number
  }
}

export type ModelGraphComputedResult =
  | { status: "ready"; layout: ModelGraphLayout }
  | ModelGraphTooLargeResult

export interface ModelGraphWorkerRequest {
  type: "layout"
  requestId: number
  schemaId: number
  schemaCount: number
  filter: string
  schemas?: Record<string, SchemaObject>
}

export type ModelGraphWorkerMessage =
  | {
      type: "progress"
      requestId: number
      phase: Exclude<ModelGraphWorkerPhase, "queued">
      metrics: ModelGraphMetrics
    }
  | {
      type: "result"
      requestId: number
      result: ModelGraphComputedResult
    }
  | {
      type: "error"
      requestId: number
      message: string
    }
