import type { ParsedRoute, SchemaObject, ResponseObject } from "@/lib/openapi/types"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"
import type { PaginationConfig } from "./types"

// Normalize a possibly-composed/3.1 schema to a primitive type string.
function normalizedType(schema: SchemaObject): string | undefined {
  const t = resolveEffectiveSchema(schema).type
  return Array.isArray(t) ? t[0] : t
}

const PAGINATION_ITEMS_FIELDS = ["items", "data", "results", "records", "rows", "list", "content", "entries"]
export const PAGINATION_TOTAL_FIELDS = ["total", "count", "total_count", "totalcount", "totalitems", "total_items"]

export function getRequestBodySchema(route: ParsedRoute): SchemaObject | null {
  const content = route.requestBody?.content
  if (!content) return null
  const json = content["application/json"]
  if (json?.schema) return json.schema
  for (const media of Object.values(content)) {
    if (media.schema) return media.schema
  }
  return null
}

function getResponseSchema(responses: Record<string, ResponseObject>): SchemaObject | null {
  const ok = responses["200"] ?? responses["201"] ?? responses["2XX"] ?? responses["2xx"] ?? responses["default"]
  if (!ok) return null
  if (ok.content) {
    const json = ok.content["application/json"]
    if (json?.schema) return json.schema
    for (const media of Object.values(ok.content)) {
      if (media.schema) return media.schema
    }
  }
  if (ok.schema) return ok.schema
  return null
}

export function detectPagination(schema: SchemaObject | null): PaginationConfig {
  // Resolve allOf / OAS 3.1 array-type (["object","null"]) before inspecting.
  const resolved = schema ? resolveEffectiveSchema(schema) : null
  if (!resolved || normalizedType(resolved) !== "object" || !resolved.properties) {
    return { style: "none", itemsField: null, totalField: null }
  }

  let itemsField: string | null = null
  let totalField: string | null = null

  for (const key of Object.keys(resolved.properties)) {
    const prop = resolved.properties[key]
    if (!prop) continue
    const propType = normalizedType(prop)
    if (!itemsField && propType === "array" && PAGINATION_ITEMS_FIELDS.includes(key.toLowerCase())) {
      itemsField = key
    }
    if (!totalField && (propType === "integer" || propType === "number") && PAGINATION_TOTAL_FIELDS.includes(key.toLowerCase())) {
      totalField = key
    }
  }

  if (!itemsField) return { style: "none", itemsField: null, totalField: null }

  return { style: "offset", itemsField, totalField }
}

export function inferListItemSchema(route: ParsedRoute): { schema: SchemaObject | null; pagination: PaginationConfig } {
  const raw = getResponseSchema(route.responses)
  if (!raw) return { schema: null, pagination: { style: "none", itemsField: null, totalField: null } }
  const responseSchema = resolveEffectiveSchema(raw)

  if (normalizedType(responseSchema) === "array" && responseSchema.items) {
    return { schema: responseSchema.items as SchemaObject, pagination: { style: "none", itemsField: null, totalField: null } }
  }

  const pagination = detectPagination(responseSchema)
  if (pagination.itemsField && responseSchema.properties) {
    const arrayProp = responseSchema.properties[pagination.itemsField]
    const arrayResolved = arrayProp ? resolveEffectiveSchema(arrayProp) : null
    if (arrayResolved?.items) {
      return { schema: arrayResolved.items as SchemaObject, pagination }
    }
  }

  return { schema: null, pagination: { style: "none", itemsField: null, totalField: null } }
}

export function inferDetailSchema(route: ParsedRoute): SchemaObject | null {
  return getResponseSchema(route.responses)
}

export function inferCreateSchema(route: ParsedRoute): SchemaObject | null {
  return getRequestBodySchema(route)
}

export function inferUpdateSchema(route: ParsedRoute): SchemaObject | null {
  return getRequestBodySchema(route)
}
