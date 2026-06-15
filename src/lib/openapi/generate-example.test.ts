import { describe, expect, it } from "vitest"
import { generateExample, generateWithVariant } from "@/lib/openapi/generate-example"
import type { SchemaObject } from "@/lib/openapi/types"

describe("generateExample circular handling", () => {
  it("produces a partial example (not null) when a residual circular $ref exists", () => {
    const schema: SchemaObject = {
      type: "object",
      properties: {
        name: { type: "string" },
        self: { $ref: "#/components/schemas/Node" }, // residual circular ref
      },
    }
    const ex = generateExample(schema) as Record<string, unknown> | null
    expect(ex).not.toBeNull()
    expect(ex).toHaveProperty("name")
  })

  it("handles _circular-marked nodes without bailing to null", () => {
    const schema: SchemaObject = {
      type: "object",
      properties: {
        id: { type: "integer" },
        ref: { _circular: "#/components/schemas/Node" },
      },
    }
    expect(generateExample(schema)).not.toBeNull()
  })

  it("does not prune a schema shared between sibling fields (non-circular reuse)", () => {
    const shared: SchemaObject = { type: "object", properties: { value: { type: "string" } } }
    const schema: SchemaObject = { type: "object", properties: { a: shared, b: shared } }
    const ex = generateExample(schema) as Record<string, unknown> | null
    expect(ex).not.toBeNull()
    // Both siblings must retain content; the second must not be emptied as a "cycle".
    expect((ex?.a as Record<string, unknown> | undefined)?.value).toBeDefined()
    expect((ex?.b as Record<string, unknown> | undefined)?.value).toBeDefined()
  })
})

describe("generateWithVariant boundaries", () => {
  it("does not throw and returns a string when minLength > 30 (str-alpha)", () => {
    const schema: SchemaObject = { type: "string", minLength: 50 }
    expect(() => generateWithVariant(schema, "str-alpha")).not.toThrow()
    expect(typeof generateWithVariant(schema, "str-alpha")).toBe("string")
  })
})

describe("generateExample numeric bounds", () => {
  it("does not throw on inverted exclusive integer bounds", () => {
    const schema: SchemaObject = { type: "object", properties: { n: { type: "integer", exclusiveMinimum: 10, exclusiveMaximum: 10 } } }
    expect(() => generateExample(schema)).not.toThrow()
    expect(generateExample(schema)).not.toBeNull()
  })
})
