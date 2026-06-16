import { describe, expect, it } from "vitest"
import { validateWithSchema } from "@/lib/validate-schema"

describe("validateWithSchema", () => {
  it("returns empty array for null/undefined schema", () => {
    expect(validateWithSchema(null, { any: "data" })).toEqual([])
    expect(validateWithSchema(undefined, "data")).toEqual([])
  })

  it("returns empty array for valid data", () => {
    const errors = validateWithSchema(
      { type: "object", properties: { name: { type: "string" } } },
      { name: "Alice" },
    )
    expect(errors).toEqual([])
  })

  describe("type validation", () => {
    it("detects type mismatch", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { count: { type: "integer" } } },
        { count: "not-a-number" },
      )
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "count", message: expect.stringContaining("must be") }),
        ]),
      )
    })

    it("coerces compatible types (string → number)", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { count: { type: "integer" } } },
        { count: "42" },
      )
      expect(errors).toEqual([])
    })
  })

  describe("required fields", () => {
    it("reports missing required fields", () => {
      const errors = validateWithSchema(
        {
          type: "object",
          required: ["name", "email"],
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
        },
        {},
      )
      expect(errors).toHaveLength(2)
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "name", message: '"name" is required' }),
          expect.objectContaining({ field: "email", message: '"email" is required' }),
        ]),
      )
    })
  })

  describe("string constraints", () => {
    it("validates minLength", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { name: { type: "string", minLength: 3 } } },
        { name: "Ab" },
      )
      expect(errors).toEqual([
        expect.objectContaining({ field: "name", message: '"name" is too short (min 3)' }),
      ])
    })

    it("validates maxLength", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { code: { type: "string", maxLength: 5 } } },
        { code: "toolong" },
      )
      expect(errors).toEqual([
        expect.objectContaining({ field: "code", message: '"code" is too long (max 5)' }),
      ])
    })

    it("validates pattern", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { zip: { type: "string", pattern: "^\\d{5}$" } } },
        { zip: "abc" },
      )
      expect(errors).toEqual([
        expect.objectContaining({ field: "zip", message: '"zip" does not match pattern' }),
      ])
    })

    it("validates format: email", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { email: { type: "string", format: "email" } } },
        { email: "not-an-email" },
      )
      expect(errors).toEqual([
        expect.objectContaining({ field: "email", message: '"email" invalid format (email)' }),
      ])
    })

    it("validates format: uri", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { url: { type: "string", format: "uri" } } },
        { url: "not a url" },
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]!.field).toBe("url")
    })
  })

  describe("numeric constraints", () => {
    it("validates minimum", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { age: { type: "integer", minimum: 0 } } },
        { age: -1 },
      )
      expect(errors).toEqual([
        expect.objectContaining({ field: "age", message: '"age" must be >= 0' }),
      ])
    })

    it("validates maximum", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { score: { type: "integer", maximum: 100 } } },
        { score: 150 },
      )
      expect(errors).toEqual([
        expect.objectContaining({ field: "score", message: '"score" must be <= 100' }),
      ])
    })
  })

  describe("enum validation", () => {
    it("rejects value not in enum", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { status: { type: "string", enum: ["active", "inactive"] } } },
        { status: "unknown" },
      )
      expect(errors).toEqual([
        expect.objectContaining({ field: "status", message: '"status" must be one of allowed values' }),
      ])
    })

    it("accepts value in enum", () => {
      const errors = validateWithSchema(
        { type: "object", properties: { status: { type: "string", enum: ["active", "inactive"] } } },
        { status: "active" },
      )
      expect(errors).toEqual([])
    })
  })

  describe("nested object validation", () => {
    it("validates nested object properties", () => {
      const errors = validateWithSchema(
        {
          type: "object",
          properties: {
            address: {
              type: "object",
              required: ["city"],
              properties: {
                city: { type: "string", minLength: 1 },
                zip: { type: "string", pattern: "^\\d{5}$" },
              },
            },
          },
        },
        { address: { zip: "abc" } },
      )
      expect(errors.length).toBeGreaterThanOrEqual(2)
      const fields = errors.map(e => e.field)
      expect(fields).toContain("address")
      expect(fields).toEqual(expect.arrayContaining([expect.stringContaining("zip")]))
    })
  })

  describe("array validation", () => {
    it("validates array items type mismatch (coercion allows number→string)", () => {
      const errors = validateWithSchema(
        {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        { tags: ["valid", 123] },
      )
      // AJV with coerceTypes: true coerces 123 to "123", so this passes
      expect(errors).toEqual([])
    })
  })

  describe("internal field stripping", () => {
    it("strips _circular, _unresolved, _nullable markers", () => {
      const errors = validateWithSchema(
        {
          type: "object",
          _circular: "#/ref",
          _unresolved: "#/missing",
          properties: {
            name: { type: "string", _nullable: true },
          },
        },
        { name: "Alice" },
      )
      expect(errors).toEqual([])
    })

    it("strips x-widget extension", () => {
      const errors = validateWithSchema(
        {
          type: "object",
          properties: {
            phone: { type: "string", "x-widget": "phone" },
          },
        },
        { phone: "1234567890" },
      )
      expect(errors).toEqual([])
    })

    it("converts nullable: true to type union for AJV", () => {
      const errors = validateWithSchema(
        {
          type: "object",
          properties: {
            value: { type: "string", nullable: true },
          },
        },
        { value: null },
      )
      expect(errors).toEqual([])
    })
  })

  describe("allOf/anyOf/oneOf in validation", () => {
    it("validates allOf composition", () => {
      const errors = validateWithSchema(
        {
          allOf: [
            { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
            { type: "object", properties: { age: { type: "integer" } }, required: ["age"] },
          ],
        },
        { name: "Alice" },
      )
      expect(errors.length).toBeGreaterThan(0)
    })

    it("validates anyOf — passes if matching any variant", () => {
      const errors = validateWithSchema(
        {
          anyOf: [
            { type: "string" },
            { type: "integer" },
          ],
        },
        "hello",
      )
      expect(errors).toEqual([])
    })

    it("validates oneOf — fails if matching none", () => {
      const errors = validateWithSchema(
        {
          oneOf: [
            { type: "string", minLength: 5 },
            { type: "integer" },
          ],
        },
        true,
      )
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe("edge cases", () => {
    it("handles empty object schema (accepts anything)", () => {
      const errors = validateWithSchema({}, { any: "data" })
      expect(errors).toEqual([])
    })

    it("handles deeply nested instancePath formatting", () => {
      const errors = validateWithSchema(
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id"],
                    properties: { id: { type: "integer" } },
                  },
                },
              },
            },
          },
        },
        { data: { items: [{}] } },
      )
      expect(errors.length).toBeGreaterThan(0)
      // required error uses missingProperty for the field name
      expect(errors[0]!.message).toContain("is required")
    })
  })
})
