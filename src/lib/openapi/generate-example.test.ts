import { describe, expect, it } from "vitest"
import { generateExample, generateWithVariant, getRandomVariants } from "@/lib/openapi/generate-example"
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

describe("generateExample basic types", () => {
  it("generates a string value", () => {
    const ex = generateExample({ type: "string" })
    expect(typeof ex).toBe("string")
    expect((ex as string).length).toBeGreaterThan(0)
  })

  it("generates an integer value", () => {
    const ex = generateExample({ type: "integer" })
    expect(typeof ex).toBe("number")
    expect(Number.isInteger(ex)).toBe(true)
  })

  it("generates a number value", () => {
    const ex = generateExample({ type: "number" })
    expect(typeof ex).toBe("number")
  })

  it("generates a boolean value", () => {
    const ex = generateExample({ type: "boolean" })
    expect(typeof ex).toBe("boolean")
  })

  it("generates an array of strings", () => {
    const ex = generateExample({ type: "array", items: { type: "string" } })
    expect(Array.isArray(ex)).toBe(true)
    for (const item of ex as unknown[]) {
      expect(typeof item).toBe("string")
    }
  })

  it("generates an object with properties", () => {
    const ex = generateExample({
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        active: { type: "boolean" },
      },
    }) as Record<string, unknown>
    expect(ex).not.toBeNull()
    expect(ex).toHaveProperty("id")
    expect(ex).toHaveProperty("name")
    expect(typeof ex.id).toBe("number")
    expect(typeof ex.name).toBe("string")
  })

  it("returns null for null/undefined input", () => {
    expect(generateExample(null)).toBeNull()
    expect(generateExample(undefined)).toBeNull()
  })
})

describe("generateExample format-based generation", () => {
  it("generates a valid UUID for format: uuid", () => {
    const ex = generateExample({ type: "string", format: "uuid" }) as string
    expect(ex).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it("generates a valid email for format: email", () => {
    const ex = generateExample({ type: "string", format: "email" }) as string
    expect(ex).toContain("@")
  })

  it("generates an ISO date-time string for format: date-time", () => {
    const ex = generateExample({ type: "string", format: "date-time" }) as string
    expect(ex).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it("generates an ISO date string for format: date", () => {
    const ex = generateExample({ type: "string", format: "date" }) as string
    expect(ex).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("generates a valid IPv4 for format: ipv4", () => {
    const ex = generateExample({ type: "string", format: "ipv4" }) as string
    expect(ex).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
  })

  it("generates a URL for format: uri", () => {
    const ex = generateExample({ type: "string", format: "uri" }) as string
    expect(ex).toMatch(/^https?:\/\//)
  })
})

describe("generateExample enum handling", () => {
  it("picks a value from enum", () => {
    const ex = generateExample({
      type: "string",
      enum: ["active", "inactive", "pending"],
    })
    expect(["active", "inactive", "pending"]).toContain(ex)
  })

  it("picks from integer enum", () => {
    const ex = generateExample({
      type: "integer",
      enum: [1, 2, 3],
    })
    expect([1, 2, 3]).toContain(ex)
  })
})

describe("generateExample schema examples", () => {
  it("uses example annotation on properties", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        id: { type: "string", example: "usr_123" },
        status: { type: "string", example: "active" },
      },
    }) as Record<string, unknown>
    expect(ex.id).toBe("usr_123")
    expect(ex.status).toBe("active")
  })

  it("uses default values when example is absent", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        page: { type: "integer", default: 1 },
      },
    }) as Record<string, unknown>
    expect(ex.page).toBe(1)
  })
})

describe("generateExample numeric constraints", () => {
  it("respects integer minimum and maximum", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        age: { type: "integer", minimum: 18, maximum: 65 },
      },
    }) as Record<string, unknown>
    expect(ex.age).toBeGreaterThanOrEqual(18)
    expect(ex.age).toBeLessThanOrEqual(65)
  })

  it("handles OAS 3.0 boolean exclusiveMinimum/exclusiveMaximum", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        score: {
          type: "integer",
          minimum: 0,
          maximum: 100,
          exclusiveMinimum: true as unknown as number,
          exclusiveMaximum: true as unknown as number,
        },
      },
    }) as Record<string, unknown>
    expect(ex.score).toBeGreaterThanOrEqual(1)
    expect(ex.score).toBeLessThanOrEqual(99)
  })

  it("handles OAS 3.1 numeric exclusiveMinimum/exclusiveMaximum", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        val: { type: "integer", exclusiveMinimum: 0, exclusiveMaximum: 10 },
      },
    }) as Record<string, unknown>
    expect(ex.val).toBeGreaterThanOrEqual(1)
    expect(ex.val).toBeLessThanOrEqual(9)
  })

  it("respects float minimum and maximum", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        rate: { type: "number", minimum: 0, maximum: 1 },
      },
    }) as Record<string, unknown>
    expect(ex.rate).toBeGreaterThanOrEqual(0)
    expect(ex.rate).toBeLessThanOrEqual(1)
  })
})

describe("generateExample composition schemas", () => {
  it("generates from allOf composition", () => {
    const ex = generateExample({
      allOf: [
        { type: "object", properties: { id: { type: "integer" } } },
        { type: "object", properties: { name: { type: "string" } } },
      ],
    } as SchemaObject) as Record<string, unknown>
    expect(ex).not.toBeNull()
  })

  it("generates from nested object with array of objects", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
            },
          },
        },
      },
    }) as Record<string, unknown>
    expect(ex).not.toBeNull()
    expect(Array.isArray(ex.users)).toBe(true)
    const users = ex.users as Record<string, unknown>[]
    if (users.length > 0) {
      expect(users[0]).toHaveProperty("id")
      expect(users[0]).toHaveProperty("name")
    }
  })
})

describe("generateExample string constraints", () => {
  it("respects minLength and maxLength", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        code: { type: "string", minLength: 5, maxLength: 10 },
      },
    }) as Record<string, unknown>
    const code = ex.code as string
    expect(code.length).toBeGreaterThanOrEqual(5)
    expect(code.length).toBeLessThanOrEqual(10)
  })

  it("generates from pattern constraint", () => {
    const ex = generateExample({
      type: "object",
      properties: {
        zip: { type: "string", pattern: "^\\d{5}$" },
      },
    }) as Record<string, unknown>
    expect(ex.zip).toMatch(/^\d{5}$/)
  })
})

describe("getRandomVariants", () => {
  it("returns datetime variants for format: date-time", () => {
    const variants = getRandomVariants({ type: "string", format: "date-time" })
    expect(variants.length).toBeGreaterThan(0)
    expect(variants.map(v => v.id)).toContain("dt-recent")
  })

  it("returns date variants for format: date", () => {
    const variants = getRandomVariants({ type: "string", format: "date" })
    expect(variants.length).toBeGreaterThan(0)
    expect(variants.map(v => v.id)).toContain("date-recent")
  })

  it("returns email variants for format: email", () => {
    const variants = getRandomVariants({ type: "string", format: "email" })
    expect(variants.length).toBeGreaterThan(0)
    expect(variants.map(v => v.id)).toContain("email-random")
  })

  it("returns uuid variants for format: uuid", () => {
    const variants = getRandomVariants({ type: "string", format: "uuid" })
    expect(variants.length).toBeGreaterThan(0)
    expect(variants.map(v => v.id)).toContain("uuid-v4")
  })

  it("returns phone variants for format: phone/e164/mobile", () => {
    for (const fmt of ["phone", "e164", "mobile", "e.164", "telephone"]) {
      const variants = getRandomVariants({ type: "string", format: fmt })
      expect(variants.length).toBeGreaterThan(0)
      expect(variants.map(v => v.id)).toContain("phone-e164")
    }
  })

  it("returns string variants for plain string", () => {
    const variants = getRandomVariants({ type: "string" })
    expect(variants.length).toBeGreaterThan(0)
    expect(variants.map(v => v.id)).toContain("str-alpha")
  })

  it("returns empty for enum schema", () => {
    expect(getRandomVariants({ type: "string", enum: ["a", "b"] })).toEqual([])
  })

  it("returns empty for boolean schema", () => {
    expect(getRandomVariants({ type: "boolean" })).toEqual([])
  })

  it("returns empty for string with pattern", () => {
    expect(getRandomVariants({ type: "string", pattern: "^\\d+$" })).toEqual([])
  })
})

describe("generateWithVariant", () => {
  it("generates UUID v4 for uuid-v4 variant", () => {
    const result = generateWithVariant({ type: "string", format: "uuid" }, "uuid-v4")
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it("generates nil UUID for uuid-nil variant", () => {
    expect(generateWithVariant({ type: "string", format: "uuid" }, "uuid-nil"))
      .toBe("00000000-0000-0000-0000-000000000000")
  })

  it("generates ISO date-time for dt-recent variant", () => {
    const result = generateWithVariant({ type: "string", format: "date-time" }, "dt-recent") as string
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it("generates ISO date for date-past variant", () => {
    const result = generateWithVariant({ type: "string", format: "date" }, "date-past") as string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("generates email for email-example variant", () => {
    const result = generateWithVariant({ type: "string", format: "email" }, "email-example") as string
    expect(result).toMatch(/^user\d+@example\.com$/)
  })

  it("generates E.164 phone for phone-e164 variant", () => {
    const result = generateWithVariant({ type: "string", format: "phone" }, "phone-e164") as string
    expect(result).toMatch(/^\+\d+$/)
  })

  it("generates lorem text for str-lorem variant", () => {
    const result = generateWithVariant({ type: "string" }, "str-lorem")
    expect(typeof result).toBe("string")
    expect((result as string).length).toBeGreaterThan(0)
  })

  it("generates slug for str-slug variant", () => {
    const result = generateWithVariant({ type: "string" }, "str-slug")
    expect(typeof result).toBe("string")
  })

  it("falls back to generateExample for unknown variant", () => {
    const result = generateWithVariant({ type: "string" }, "nonexistent-variant")
    expect(typeof result).toBe("string")
  })
})
