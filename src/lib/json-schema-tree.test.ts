import { describe, expect, it } from "vitest"
import { buildJsonSchemaTree } from "@/lib/json-schema-tree"
import type { JsonSchemaTreeNode } from "@/lib/json-schema-tree"
import { createSchemaLookup, getOpenAPISchemaViewerItems } from "@/lib/schema-viewer"
import type { OpenAPISpec } from "@/lib/openapi/types"

function flatten(nodes: JsonSchemaTreeNode[]): JsonSchemaTreeNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children)])
}

describe("json schema tree", () => {
  it("builds a tree from standard JSON Schema nodes", () => {
    const nodes = buildJsonSchemaTree({
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", format: "uuid", description: "Record id" },
        name: { type: "string", maxLength: 256, pattern: "^[^\\x00]*$" },
        count: { type: "integer", minimum: 1, maximum: 10, multipleOf: 1 },
        tags: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true, items: { type: "string" } },
        status: { enum: ["draft", "published"], default: "draft" },
      },
    }, new Map())
    const flat = flatten(nodes)

    expect(flat.find(node => node.name === "id")).toMatchObject({
      required: true,
      typeLabel: "string (uuid)",
      typeInfo: {
        summary: "string",
        format: "uuid",
        combiner: "",
        variantCount: 0,
      },
      description: "Record id",
    })
    expect(flat.find(node => node.name === "status")?.enumValues).toEqual(["draft", "published"])
    expect(flat.find(node => node.name === "status")?.typeInfo.summary).toBe("enum<string>")
    expect(flat.find(node => node.name === "name")?.constraints).toEqual([
      expect.objectContaining({
        keyword: "maxLength",
        labelKey: "maxLength",
        value: "256",
        rawLabel: "maxLength: 256",
        monospace: false,
      }),
      expect.objectContaining({
        keyword: "pattern",
        labelKey: "patternNoNull",
        value: "^[^\\x00]*$",
        rawLabel: "pattern: ^[^\\x00]*$",
        monospace: false,
      }),
    ])
    expect(flat.find(node => node.name === "count")?.constraints.map(constraint => constraint.labelKey)).toEqual([
      "minimum",
      "maximum",
      "multipleOf",
    ])
    expect(flat.find(node => node.name === "tags")?.constraints.map(constraint => constraint.labelKey)).toEqual([
      "minItems",
      "maxItems",
      "uniqueItems",
    ])
  })

  it("uses the Stoplight resolver for local schema references", () => {
    const spec: OpenAPISpec = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {},
      components: {
        schemas: {
          User: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
          UserResponse: {
            type: "object",
            properties: {
              user: { $ref: "#/components/schemas/User" },
            },
          },
        },
      },
    }
    const items = getOpenAPISchemaViewerItems(spec)
    const lookup = createSchemaLookup(items)
    const response = items.find(item => item.id === "UserResponse")
    expect(response).toBeDefined()

    const nodes = buildJsonSchemaTree(response!.schema, lookup)
    const flat = flatten(nodes)

    expect(flat.some(node => node.name === "user" && node.typeLabel === "object")).toBe(true)
    expect(flat.some(node => node.name === "name" && node.typeLabel === "string")).toBe(true)
  })

  it("summarizes anyOf variants as readable union types", () => {
    const nodes = buildJsonSchemaTree({
      type: "object",
      required: ["content"],
      properties: {
        content: {
          anyOf: [
            { type: "string" },
            {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                },
              },
            },
          ],
        },
      },
    }, new Map())
    const flat = flatten(nodes)
    const content = flat.find(node => node.path === "#/properties/content")

    expect(content).toMatchObject({
      required: true,
      typeInfo: {
        summary: "string | array<object>",
        combiner: "anyOf",
        variantCount: 2,
      },
    })
  })
})
