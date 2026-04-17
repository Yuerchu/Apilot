import { describe, expect, it } from "vitest"
import { buildSchemaGraph } from "@/lib/openapi/schema-graph"
import type { SchemaObject } from "@/lib/openapi/types"

describe("schema graph", () => {
  it("builds sorted nodes and relationship edges from refs and combiners", () => {
    const schemas: Record<string, SchemaObject> = {
      UserBase: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      },
      User: {
        allOf: [
          { $ref: "#/components/schemas/UserBase" },
          {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        ],
      },
      Tag: { type: "string" },
      Meta: { type: "object" },
      UserResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          tags: { type: "array", items: { $ref: "#/components/schemas/Tag" } },
          metadata: { type: "object", additionalProperties: { $ref: "#/components/schemas/Meta" } },
        },
      },
      SearchResult: {
        oneOf: [
          { $ref: "#/components/schemas/User" },
          { $ref: "#/components/schemas/Tag" },
        ],
      },
    }

    const graph = buildSchemaGraph(schemas)

    expect(graph.nodes.map(node => node.id)).toEqual(["Meta", "SearchResult", "Tag", "User", "UserBase", "UserResponse"])
    expect(graph.nodes.find(node => node.id === "UserResponse")).toMatchObject({
      type: "object",
      fieldCount: 3,
    })
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "UserBase", target: "User", kind: "extends", label: "allOf[0]" }),
      expect.objectContaining({ source: "UserResponse", target: "User", kind: "references", label: "user" }),
      expect.objectContaining({ source: "UserResponse", target: "Tag", kind: "references", label: "tags[]" }),
      expect.objectContaining({ source: "UserResponse", target: "Meta", kind: "references", label: "metadata{}" }),
      expect.objectContaining({ source: "SearchResult", target: "User", kind: "variant", label: "oneOf[0]" }),
    ]))
  })

  it("decodes JSON pointer model names and skips self edges", () => {
    const graph = buildSchemaGraph({
      "A/B": {
        type: "object",
        properties: {
          self: { $ref: "#/components/schemas/A~1B" },
        },
      },
      "Tilde~Model": { $ref: "#/components/schemas/A~1B" },
    })

    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: "Tilde~Model",
        target: "A/B",
        kind: "references",
      }),
    ])
  })
})
