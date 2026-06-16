import { describe, expect, it } from "vitest"
import { resolveEffectiveSchema, getObjectVariants } from "@/lib/openapi/resolve-schema"
import type { SchemaObject, OpenAPISchemaType } from "@/lib/openapi/types"

describe("resolveEffectiveSchema", () => {
  it("returns _nullable: false for a plain schema", () => {
    const result = resolveEffectiveSchema({ type: "string" })
    expect(result).toMatchObject({ type: "string", _nullable: false })
  })

  it("handles null/undefined input gracefully", () => {
    expect(resolveEffectiveSchema(null)).toMatchObject({ _nullable: false })
    expect(resolveEffectiveSchema(undefined)).toMatchObject({ _nullable: false })
  })

  describe("allOf merging", () => {
    it("merges properties from multiple allOf parts", () => {
      const result = resolveEffectiveSchema({
        allOf: [
          { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
          { properties: { name: { type: "string" } }, required: ["name"] },
        ],
      })
      expect(result.properties).toHaveProperty("id")
      expect(result.properties).toHaveProperty("name")
      expect(result.required).toEqual(expect.arrayContaining(["id", "name"]))
    })

    it("deduplicates required fields", () => {
      const result = resolveEffectiveSchema({
        allOf: [
          { required: ["id", "name"] },
          { required: ["name", "email"] },
        ],
      })
      const required = result.required as string[]
      expect(required).toHaveLength(3)
      expect(new Set(required)).toEqual(new Set(["id", "name", "email"]))
    })

    it("deep-merges overlapping property schemas", () => {
      const result = resolveEffectiveSchema({
        allOf: [
          { properties: { meta: { type: "object", description: "from part 1" } } },
          { properties: { meta: { format: "json", title: "Meta" } } },
        ],
      })
      const meta = result.properties!.meta as SchemaObject
      expect(meta.type).toBe("object")
      expect(meta.format).toBe("json")
      expect(meta.title).toBe("Meta")
    })

    it("outer schema properties override allOf parts", () => {
      const result = resolveEffectiveSchema({
        allOf: [
          { properties: { name: { type: "string", maxLength: 100 } } },
        ],
        properties: { name: { type: "string", maxLength: 50 } },
      })
      expect((result.properties!.name as SchemaObject).maxLength).toBe(50)
    })

    it("carries non-property fields from allOf parts", () => {
      const result = resolveEffectiveSchema({
        allOf: [
          { type: "object", description: "Base" },
          { title: "Extended" },
        ],
      })
      expect(result.type).toBe("object")
      expect(result.title).toBe("Extended")
    })

    it("skips dangerous keys (__proto__, constructor, prototype)", () => {
      const result = resolveEffectiveSchema({
        allOf: [
          { properties: { "__proto__": { type: "string" }, name: { type: "string" } } } as SchemaObject,
          { properties: { constructor: { type: "string" } } } as SchemaObject,
        ],
      })
      expect(result.properties).toHaveProperty("name")
      expect(result.properties).not.toHaveProperty("__proto__")
      expect(result.properties).not.toHaveProperty("constructor")
    })
  })

  describe("OAS 3.1 type array", () => {
    it("unwraps [\"string\", \"null\"] to type: \"string\" + _nullable", () => {
      const result = resolveEffectiveSchema({ type: ["string", "null"] as OpenAPISchemaType[] })
      expect(result.type).toBe("string")
      expect(result._nullable).toBe(true)
    })

    it("keeps multi-type array without null as-is", () => {
      const result = resolveEffectiveSchema({ type: ["string", "integer"] as OpenAPISchemaType[] })
      expect(result.type).toEqual(["string", "integer"])
      expect(result._nullable).toBe(false)
    })

    it("handles [\"null\"] only — nullable with empty type", () => {
      const result = resolveEffectiveSchema({ type: ["null"] as OpenAPISchemaType[] })
      expect(result._nullable).toBe(true)
    })
  })

  describe("OAS 3.0 nullable", () => {
    it("sets _nullable for nullable: true", () => {
      const result = resolveEffectiveSchema({ type: "string", nullable: true })
      expect(result._nullable).toBe(true)
    })

    it("does not set _nullable for nullable: false", () => {
      const result = resolveEffectiveSchema({ type: "string", nullable: false })
      expect(result._nullable).toBe(false)
    })
  })

  describe("anyOf/oneOf nullable collapse", () => {
    it("collapses anyOf: [SomeType, {type:\"null\"}] to the non-null variant", () => {
      const result = resolveEffectiveSchema({
        anyOf: [
          { type: "string", format: "email" },
          { type: "null" },
        ],
        description: "top-level desc",
      })
      expect(result.type).toBe("string")
      expect(result.format).toBe("email")
      expect(result._nullable).toBe(true)
      expect(result.description).toBe("top-level desc")
    })

    it("collapses oneOf nullable pattern the same way", () => {
      const result = resolveEffectiveSchema({
        oneOf: [
          { type: "null" },
          { type: "integer", minimum: 0 },
        ],
      })
      expect(result.type).toBe("integer")
      expect(result.minimum).toBe(0)
      expect(result._nullable).toBe(true)
    })

    it("does NOT collapse when there are 2+ non-null variants", () => {
      const result = resolveEffectiveSchema({
        anyOf: [
          { type: "string" },
          { type: "integer" },
          { type: "null" },
        ],
      })
      expect(result._nullable).toBe(false)
      expect(result.anyOf).toBeDefined()
    })

    it("preserves top-level default/description/title on the collapsed variant", () => {
      const result = resolveEffectiveSchema({
        anyOf: [
          { type: "string" },
          { type: "null" },
        ],
        default: "hello",
        description: "A field",
        title: "MyField",
      })
      expect(result.default).toBe("hello")
      expect(result.description).toBe("A field")
      expect(result.title).toBe("MyField")
    })

    it("does not override variant's own default/description/title", () => {
      const result = resolveEffectiveSchema({
        anyOf: [
          { type: "string", default: "inner", description: "inner desc", title: "Inner" },
          { type: "null" },
        ],
        default: "outer",
        description: "outer desc",
        title: "Outer",
      })
      expect(result.default).toBe("inner")
      expect(result.description).toBe("inner desc")
      expect(result.title).toBe("Inner")
    })

    it("handles OAS 3.1 null variant as type: [\"null\"]", () => {
      const result = resolveEffectiveSchema({
        anyOf: [
          { type: "string" },
          { type: ["null"] as OpenAPISchemaType[] },
        ],
      })
      expect(result.type).toBe("string")
      expect(result._nullable).toBe(true)
    })
  })

  describe("combined allOf + nullable", () => {
    it("merges allOf then detects nullable", () => {
      const result = resolveEffectiveSchema({
        allOf: [
          { type: "object", properties: { id: { type: "integer" } } },
        ],
        nullable: true,
      })
      expect(result.type).toBe("object")
      expect(result._nullable).toBe(true)
      expect(result.properties).toHaveProperty("id")
    })
  })
})

describe("getObjectVariants", () => {
  it("returns resolved object variants from anyOf", () => {
    const variants = getObjectVariants({
      anyOf: [
        { type: "object", properties: { name: { type: "string" } } },
        { type: "string" },
        { type: "object", properties: { id: { type: "integer" } } },
      ],
    })
    expect(variants).toHaveLength(2)
    expect(variants[0]!.properties).toHaveProperty("name")
    expect(variants[1]!.properties).toHaveProperty("id")
  })

  it("returns resolved object variants from oneOf", () => {
    const variants = getObjectVariants({
      oneOf: [
        { properties: { a: { type: "string" } } },
        { type: "integer" },
      ],
    })
    expect(variants).toHaveLength(1)
  })

  it("returns empty array for schema without anyOf/oneOf", () => {
    expect(getObjectVariants({ type: "object" })).toEqual([])
  })

  it("returns empty array when no variant is an object", () => {
    expect(getObjectVariants({
      anyOf: [{ type: "string" }, { type: "integer" }],
    })).toEqual([])
  })
})
