import { describe, expect, it } from "vitest"
import { getTypeStr, getConstraints } from "@/lib/openapi/type-str"
import type { OpenAPISchemaType } from "@/lib/openapi/types"

describe("getTypeStr", () => {
  it("returns 'any' for undefined schema", () => {
    expect(getTypeStr(undefined)).toBe("any")
  })

  it("returns 'any' for schema without type", () => {
    expect(getTypeStr({})).toBe("any")
  })

  it("returns basic types", () => {
    expect(getTypeStr({ type: "string" })).toBe("string")
    expect(getTypeStr({ type: "integer" })).toBe("integer")
    expect(getTypeStr({ type: "number" })).toBe("number")
    expect(getTypeStr({ type: "boolean" })).toBe("boolean")
    expect(getTypeStr({ type: "object" })).toBe("object")
    expect(getTypeStr({ type: "array" })).toBe("array")
  })

  it("appends format in parentheses", () => {
    expect(getTypeStr({ type: "string", format: "uuid" })).toBe("string(uuid)")
    expect(getTypeStr({ type: "string", format: "date-time" })).toBe("string(date-time)")
    expect(getTypeStr({ type: "integer", format: "int64" })).toBe("integer(int64)")
    expect(getTypeStr({ type: "number", format: "double" })).toBe("number(double)")
  })

  it("renders const value", () => {
    expect(getTypeStr({ type: "string", const: "active" })).toBe('string const: "active"')
    expect(getTypeStr({ type: "integer", const: 42 })).toBe("integer const: 42")
  })

  it("renders enum values", () => {
    expect(getTypeStr({ type: "string", enum: ["a", "b", "c"] })).toBe("string enum: [a, b, c]")
  })

  it("renders enum with mixed types including objects", () => {
    expect(getTypeStr({ type: "string", enum: ["text", null, { key: "val" }] }))
      .toBe('string enum: [text, null, {"key":"val"}]')
  })

  it("renders default value", () => {
    expect(getTypeStr({ type: "string", default: "hello" })).toBe('string default: "hello"')
    expect(getTypeStr({ type: "integer", default: 0 })).toBe("integer default: 0")
    expect(getTypeStr({ type: "boolean", default: false })).toBe("boolean default: false")
  })

  it("combines format, enum, and default", () => {
    expect(getTypeStr({
      type: "string",
      format: "uuid",
      enum: ["a", "b"],
      default: "a",
    })).toBe('string(uuid) enum: [a, b] default: "a"')
  })

  describe("OAS 3.1 type array", () => {
    it("renders multi-type with null filtered", () => {
      expect(getTypeStr({ type: ["string", "null"] as OpenAPISchemaType[] }))
        .toBe("string | null")
    })

    it("renders multi-type without null", () => {
      expect(getTypeStr({ type: ["string", "integer"] as OpenAPISchemaType[] }))
        .toBe("string | integer")
    })

    it("renders all-null type as any | null", () => {
      expect(getTypeStr({ type: ["null"] as OpenAPISchemaType[] }))
        .toBe("any | null")
    })
  })

  describe("nullable annotations", () => {
    it("appends | null for OAS 3.0 nullable: true", () => {
      expect(getTypeStr({ type: "string", nullable: true })).toBe("string | null")
    })

    it("appends | null for Swagger 2.0 x-nullable", () => {
      expect(getTypeStr({ type: "integer", "x-nullable": true })).toBe("integer | null")
    })
  })

  describe("anyOf/oneOf nullable union", () => {
    it("collapses anyOf: [string, null] to type | null", () => {
      expect(getTypeStr({
        anyOf: [{ type: "string" }, { type: "null" }],
      })).toBe("string | null")
    })

    it("collapses oneOf nullable union", () => {
      expect(getTypeStr({
        oneOf: [{ type: "null" }, { type: "integer", format: "int32" }],
      })).toBe("integer(int32) | null")
    })

    it("does not collapse with 2+ non-null variants", () => {
      const result = getTypeStr({
        anyOf: [{ type: "string" }, { type: "integer" }, { type: "null" }],
      })
      expect(result).toBe("any")
    })

    it("handles OAS 3.1 null variant type: [\"null\"]", () => {
      expect(getTypeStr({
        anyOf: [{ type: "string" }, { type: ["null"] as OpenAPISchemaType[] }],
      })).toBe("string | null")
    })
  })
})

describe("getConstraints", () => {
  it("returns empty string for schema without constraints", () => {
    expect(getConstraints({ type: "string" })).toBe("")
  })

  describe("string constraints", () => {
    it("renders minLength and maxLength", () => {
      expect(getConstraints({ type: "string", minLength: 1, maxLength: 255 }))
        .toBe(" [maxLen: 255, minLen: 1]")
    })

    it("renders pattern", () => {
      expect(getConstraints({ type: "string", pattern: "^[a-z]+$" }))
        .toBe(" [pattern: ^[a-z]+$]")
    })
  })

  describe("numeric constraints", () => {
    it("renders minimum and maximum", () => {
      expect(getConstraints({ type: "integer", minimum: 0, maximum: 100 }))
        .toBe(" [max: 100, min: 0]")
    })

    it("renders OAS 3.0 exclusive bounds (boolean form)", () => {
      expect(getConstraints({
        type: "integer",
        minimum: 0,
        maximum: 100,
        exclusiveMinimum: true as never,
        exclusiveMaximum: true as never,
      })).toBe(" [max: <100, min: >0]")
    })

    it("renders OAS 3.1 exclusive bounds (numeric form)", () => {
      expect(getConstraints({
        type: "number",
        exclusiveMinimum: 0,
        exclusiveMaximum: 100,
      })).toBe(" [exclusiveMax: 100, exclusiveMin: 0]")
    })

    it("renders both OAS 3.0 bounds and OAS 3.1 exclusive bounds together", () => {
      const result = getConstraints({
        type: "number",
        minimum: 0,
        maximum: 100,
        exclusiveMinimum: 5,
        exclusiveMaximum: 95,
      })
      expect(result).toContain("max: 100")
      expect(result).toContain("min: 0")
      expect(result).toContain("exclusiveMax: 95")
      expect(result).toContain("exclusiveMin: 5")
    })
  })

  describe("array constraints", () => {
    it("renders minItems and maxItems", () => {
      expect(getConstraints({ type: "array", minItems: 1, maxItems: 10 }))
        .toBe(" [maxItems: 10, minItems: 1]")
    })

    it("renders uniqueItems flag", () => {
      expect(getConstraints({ type: "array", uniqueItems: true }))
        .toBe(" [uniqueItems]")
    })

    it("renders all array constraints combined", () => {
      expect(getConstraints({ type: "array", minItems: 0, maxItems: 50, uniqueItems: true }))
        .toBe(" [maxItems: 50, minItems: 0, uniqueItems]")
    })
  })

  it("combines string and numeric constraints on one schema", () => {
    const result = getConstraints({
      type: "string",
      minLength: 5,
      maxLength: 100,
      pattern: "^\\d+$",
    })
    expect(result).toContain("maxLen: 100")
    expect(result).toContain("minLen: 5")
    expect(result).toContain("pattern: ^\\d+$")
  })
})
