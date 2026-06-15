import { describe, expect, it } from "vitest"
import { detectPagination, inferListItemSchema } from "@/lib/console/schema-inference"
import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"

function routeWithResponse(schema: SchemaObject): ParsedRoute {
  return { responses: { "200": { content: { "application/json": { schema } } } } } as ParsedRoute
}

describe("detectPagination (allOf / OAS 3.1)", () => {
  it("detects items/total on an OAS 3.1 nullable object (type: [object, null])", () => {
    const schema: SchemaObject = {
      type: ["object", "null"],
      properties: {
        items: { type: ["array", "null"], items: { type: "object" } },
        total: { type: "integer" },
      },
    }
    const p = detectPagination(schema)
    expect(p.style).toBe("offset")
    expect(p.itemsField).toBe("items")
    expect(p.totalField).toBe("total")
  })

  it("detects pagination through an allOf composition", () => {
    const schema: SchemaObject = {
      allOf: [
        { type: "object", properties: { total: { type: "integer" } } },
        { type: "object", properties: { results: { type: "array", items: { type: "object" } } } },
      ],
    }
    const p = detectPagination(schema)
    expect(p.itemsField).toBe("results")
    expect(p.totalField).toBe("total")
  })

  it("returns none when there is no array field", () => {
    const p = detectPagination({ type: "object", properties: { name: { type: "string" } } })
    expect(p.style).toBe("none")
  })
})

describe("inferListItemSchema (allOf / OAS 3.1)", () => {
  it("unwraps an OAS 3.1 nullable array response", () => {
    const route = routeWithResponse({ type: ["array", "null"], items: { type: "object", properties: { id: { type: "integer" } } } })
    const { schema } = inferListItemSchema(route)
    expect(schema?.properties?.id).toBeDefined()
  })

  it("finds the list item schema inside an allOf paginated response", () => {
    const route = routeWithResponse({
      allOf: [
        { type: "object", properties: { total: { type: "integer" } } },
        { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } } } },
      ],
    })
    const { schema, pagination } = inferListItemSchema(route)
    expect(pagination.itemsField).toBe("items")
    expect(schema?.properties?.name).toBeDefined()
  })
})
