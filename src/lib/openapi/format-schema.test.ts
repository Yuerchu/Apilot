import { describe, expect, it } from "vitest"
import { formatSchema } from "@/lib/openapi/format-schema"
import type { SchemaObject } from "@/lib/openapi/types"

describe("formatSchema", () => {
  it("returns 'any' for undefined schema", () => {
    expect(formatSchema(undefined)).toBe("any")
  })

  it("renders scalar types with format and description", () => {
    expect(formatSchema({ type: "string", format: "email", description: "User email" }))
      .toBe('string(email) — User email')
  })

  it("renders scalar with title", () => {
    expect(formatSchema({ type: "integer", title: "Count" }))
      .toBe("integer (Count)")
  })

  describe("object schemas", () => {
    it("renders object with required and optional properties", () => {
      const output = formatSchema({
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "integer" },
          name: { type: "string", description: "User name" },
        },
      })
      expect(output).toContain("object")
      expect(output).toContain("id (required): integer")
      expect(output).toContain("name: string — User name")
    })

    it("renders additionalProperties: false annotation", () => {
      const output = formatSchema({
        type: "object",
        additionalProperties: false,
        properties: { x: { type: "string" } },
      })
      expect(output).toContain("additionalProperties: false")
    })

    it("renders nested objects recursively", () => {
      const output = formatSchema({
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: {
              city: { type: "string" },
              zip: { type: "string", pattern: "^\\d{5}$" },
            },
          },
        },
      })
      expect(output).toContain("address: object")
      expect(output).toContain("city: string")
      expect(output).toContain("zip: string")
    })

    it("renders property constraints", () => {
      const output = formatSchema({
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
        },
      })
      expect(output).toContain("maxLen: 100")
      expect(output).toContain("minLen: 1")
    })

    it("renders inferred object (has properties but no type)", () => {
      const output = formatSchema({
        properties: { key: { type: "string" } },
      } as SchemaObject)
      expect(output).toContain("object")
      expect(output).toContain("key: string")
    })
  })

  describe("array schemas", () => {
    it("renders array with scalar items", () => {
      const output = formatSchema({
        type: "array",
        items: { type: "string" },
      })
      expect(output).toContain("array")
      expect(output).toContain("items: string")
    })

    it("renders array with object items expanded", () => {
      const output = formatSchema({
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "integer" },
          },
        },
      })
      expect(output).toContain("array")
      expect(output).toContain("items: object")
      expect(output).toContain("id: integer")
    })

    it("renders array of objects inside an object property", () => {
      const output = formatSchema({
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
        },
      })
      expect(output).toContain("tags: array")
      expect(output).toContain("items:")
      expect(output).toContain("name: string")
    })
  })

  describe("combiner schemas", () => {
    it("renders allOf with sub-schemas", () => {
      const output = formatSchema({
        allOf: [
          { type: "object", properties: { id: { type: "integer" } } },
          { type: "object", properties: { name: { type: "string" } } },
        ],
      } as SchemaObject)
      expect(output).toContain("allOf:")
      expect(output).toContain("id: integer")
      expect(output).toContain("name: string")
    })

    it("renders anyOf with numbered variants", () => {
      const output = formatSchema({
        anyOf: [
          { type: "string" },
          { type: "integer" },
        ],
      } as SchemaObject)
      expect(output).toContain("anyOf:")
      expect(output).toContain("#0:")
      expect(output).toContain("#1:")
      expect(output).toContain("string")
      expect(output).toContain("integer")
    })

    it("renders oneOf with numbered variants", () => {
      const output = formatSchema({
        oneOf: [
          { type: "object", properties: { a: { type: "string" } } },
          { type: "object", properties: { b: { type: "integer" } } },
        ],
      } as SchemaObject)
      expect(output).toContain("oneOf:")
      expect(output).toContain("#0:")
      expect(output).toContain("#1:")
    })

    it("renders property with inline combiner", () => {
      const output = formatSchema({
        type: "object",
        properties: {
          status: {
            anyOf: [
              { type: "string" },
              { type: "integer" },
            ],
          } as SchemaObject,
        },
      })
      expect(output).toContain("status:")
      expect(output).toContain("anyOf:")
    })
  })

  describe("special markers", () => {
    it("renders circular reference marker", () => {
      expect(formatSchema({ _circular: "#/components/schemas/Node" } as SchemaObject))
        .toContain("(circular: #/components/schemas/Node)")
    })

    it("renders unresolved reference marker", () => {
      expect(formatSchema({ _unresolved: "#/components/schemas/Missing" } as SchemaObject))
        .toContain("(unresolved: #/components/schemas/Missing)")
    })
  })

  describe("depth limit", () => {
    it("stops at maxDepth and renders ellipsis", () => {
      const output = formatSchema(
        { type: "object", properties: { a: { type: "string" } } },
        0,
        0,
      )
      expect(output).toBe("...")
    })

    it("decrements maxDepth through nesting", () => {
      const output = formatSchema(
        {
          type: "object",
          properties: {
            child: {
              type: "object",
              properties: { value: { type: "string" } },
            },
          },
        },
        0,
        1,
      )
      expect(output).toContain("child: object")
      expect(output).toContain("...")
    })
  })
})
