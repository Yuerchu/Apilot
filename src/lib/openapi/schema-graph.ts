import type { SchemaObject } from "./types"
import { getTypeStr } from "./type-str"
import { resolveEffectiveSchema } from "./resolve-schema"

export type SchemaGraphEdgeKind = "extends" | "references" | "variant"

export interface SchemaGraphNode {
  id: string
  name: string
  type: string
  fieldCount: number
}

export interface SchemaGraphEdge {
  id: string
  source: string
  target: string
  label: string
  kind: SchemaGraphEdgeKind
}

export interface SchemaGraph {
  nodes: SchemaGraphNode[]
  edges: SchemaGraphEdge[]
}

const REF_PATTERN = /^#\/(?:components\/schemas|definitions)\/(.+)$/

function decodeRefName(value: string): string {
  try {
    return decodeURIComponent(value).replace(/~1/g, "/").replace(/~0/g, "~")
  } catch {
    return value.replace(/~1/g, "/").replace(/~0/g, "~")
  }
}

function getRefName(ref: string): string | null {
  const match = ref.match(REF_PATTERN)
  const name = match?.[1]
  return name ? decodeRefName(name) : null
}

function countTopLevelFields(schema: SchemaObject): number {
  const effectiveSchema = resolveEffectiveSchema(schema)
  return Object.keys(effectiveSchema.properties || {}).length
}

function edgeKey(source: string, target: string, label: string, kind: SchemaGraphEdgeKind): string {
  return `${kind}:${source}->${target}:${label}`
}

function addEdge(
  edges: Map<string, SchemaGraphEdge>,
  availableModels: Set<string>,
  source: string,
  target: string,
  label: string,
  kind: SchemaGraphEdgeKind,
) {
  if (source === target || !availableModels.has(source) || !availableModels.has(target)) return
  const id = edgeKey(source, target, label, kind)
  if (edges.has(id)) return
  edges.set(id, { id, source, target, label, kind })
}

function scanSchema(
  schema: SchemaObject | undefined,
  ownerName: string,
  path: string,
  availableModels: Set<string>,
  edges: Map<string, SchemaGraphEdge>,
  seen: WeakSet<object>,
) {
  if (!schema || typeof schema !== "object") return
  if (seen.has(schema)) return
  seen.add(schema)

  if (schema.$ref) {
    const target = getRefName(schema.$ref)
    if (target) addEdge(edges, availableModels, ownerName, target, path, "references")
  }

  schema.allOf?.forEach((part, index) => {
    const label = `allOf[${index}]`
    if (part.$ref) {
      const parent = getRefName(part.$ref)
      if (parent) addEdge(edges, availableModels, parent, ownerName, label, "extends")
      return
    }
    scanSchema(part, ownerName, label, availableModels, edges, seen)
  })

  schema.anyOf?.forEach((part, index) => {
    const label = `anyOf[${index}]`
    if (part.$ref) {
      const target = getRefName(part.$ref)
      if (target) addEdge(edges, availableModels, ownerName, target, label, "variant")
      return
    }
    scanSchema(part, ownerName, label, availableModels, edges, seen)
  })

  schema.oneOf?.forEach((part, index) => {
    const label = `oneOf[${index}]`
    if (part.$ref) {
      const target = getRefName(part.$ref)
      if (target) addEdge(edges, availableModels, ownerName, target, label, "variant")
      return
    }
    scanSchema(part, ownerName, label, availableModels, edges, seen)
  })

  for (const [propertyName, propertySchema] of Object.entries(schema.properties || {})) {
    scanSchema(propertySchema, ownerName, propertyName, availableModels, edges, seen)
  }

  if (schema.items) {
    scanSchema(schema.items, ownerName, path ? `${path}[]` : "items", availableModels, edges, seen)
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    scanSchema(
      schema.additionalProperties,
      ownerName,
      path ? `${path}{}` : "additionalProperties",
      availableModels,
      edges,
      seen,
    )
  }
}

export function buildSchemaGraph(schemas: Record<string, SchemaObject>): SchemaGraph {
  const availableModels = new Set(Object.keys(schemas))
  const edges = new Map<string, SchemaGraphEdge>()
  const nodes = Object.entries(schemas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, schema]) => ({
      id: name,
      name,
      type: getTypeStr(schema),
      fieldCount: countTopLevelFields(schema),
    }))

  for (const [name, schema] of Object.entries(schemas)) {
    scanSchema(schema, name, "schema", availableModels, edges, new WeakSet<object>())
  }

  return {
    nodes,
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
  }
}
