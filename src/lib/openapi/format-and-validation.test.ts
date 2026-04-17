import { describe, expect, it } from "vitest"
import { validateWithSchema } from "@/lib/validate-schema"
import { formatSchema } from "@/lib/openapi/format-schema"
import { generateExample } from "@/lib/openapi/generate-example"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"
import { getConstraints, getTypeStr } from "@/lib/openapi/type-str"

describe("schema formatting and validation helpers", () => {
  it("formats schema types and constraints", () => {
    expect(getTypeStr({
      type: "string",
      format: "uuid",
      enum: ["a", "b"],
      default: "a",
    })).toBe('string(uuid) enum: [a, b] default: "a"')

    expect(getConstraints({
      type: "array",
      minItems: 1,
      maxItems: 3,
      uniqueItems: true,
    })).toBe(" [maxItems: 3, minItems: 1, uniqueItems]")
  })

  it("resolves nullable anyOf schemas while preserving top-level metadata", () => {
    expect(resolveEffectiveSchema({
      anyOf: [
        { type: "null" },
        { type: "string" },
      ],
      default: "draft",
      description: "Status value",
    })).toMatchObject({
      type: "string",
      default: "draft",
      description: "Status value",
      _nullable: true,
    })
  })

  it("prints nested object and array schemas", () => {
    const output = formatSchema({
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", format: "uuid", description: "Record id" },
        tags: { type: "array", items: { type: "string" } },
      },
    })

    expect(output).toContain("object")
    expect(output).toContain("id (required): string(uuid)")
    expect(output).toContain("tags: array")
  })

  it("generates examples from schema examples", () => {
    expect(generateExample({
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string", example: "usr_123" },
        name: { type: "string", example: "Alice" },
      },
    })).toEqual({
      id: "usr_123",
      name: "Alice",
    })
  })

  it("validates data and strips internal schema markers before compiling", () => {
    const errors = validateWithSchema({
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", minLength: 3, _unresolved: "ignored" },
        email: { type: "string", format: "email" },
      },
      _circular: "ignored",
    }, {
      name: "Al",
      email: "not-an-email",
    })

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "name", message: '"name" is too short (min 3)' }),
      expect.objectContaining({ field: "email", message: '"email" invalid format (email)' }),
    ]))
  })
})
