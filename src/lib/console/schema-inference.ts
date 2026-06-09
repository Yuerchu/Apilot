import type { ParsedRoute, SchemaObject, ResponseObject } from "@/lib/openapi/types"
import type { PaginationConfig } from "./types"

const PAGINATION_ITEMS_FIELDS = ["items", "data", "results", "records", "rows", "list", "content", "entries"]
const PAGINATION_TOTAL_FIELDS = ["total", "count", "total_count", "totalCount", "totalItems", "total_items"]

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
  const ok = responses["200"] ?? responses["201"] ?? responses["2XX"]
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
  if (!schema || schema.type !== "object" || !schema.properties) {
    return { style: "none", itemsField: null, totalField: null }
  }

  let itemsField: string | null = null
  let totalField: string | null = null

  for (const key of Object.keys(schema.properties)) {
    const prop = schema.properties[key]
    if (!prop) continue
    if (!itemsField && prop.type === "array" && PAGINATION_ITEMS_FIELDS.includes(key.toLowerCase())) {
      itemsField = key
    }
    if (!totalField && (prop.type === "integer" || prop.type === "number") && PAGINATION_TOTAL_FIELDS.includes(key.toLowerCase())) {
      totalField = key
    }
  }

  if (!itemsField) return { style: "none", itemsField: null, totalField: null }

  return { style: "offset", itemsField, totalField }
}

export function inferListItemSchema(route: ParsedRoute): { schema: SchemaObject | null; pagination: PaginationConfig } {
  const responseSchema = getResponseSchema(route.responses)
  if (!responseSchema) return { schema: null, pagination: { style: "none", itemsField: null, totalField: null } }

  if (responseSchema.type === "array" && responseSchema.items) {
    return { schema: responseSchema.items, pagination: { style: "none", itemsField: null, totalField: null } }
  }

  const pagination = detectPagination(responseSchema)
  if (pagination.itemsField && responseSchema.properties) {
    const arrayProp = responseSchema.properties[pagination.itemsField]
    if (arrayProp?.items) {
      return { schema: arrayProp.items, pagination }
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
