import type { SchemaObject } from "./types"
import { resolveEffectiveSchema } from "./resolve-schema"
import { sample } from "openapi-sampler"
import { faker } from "@faker-js/faker/locale/en"
import RandExp from "randexp"

function fakerForSchema(schema: SchemaObject): unknown {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type
  const fmt = schema.format

  // Integer
  if (type === "integer") {
    const min = schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1
      : schema.minimum !== undefined ? schema.minimum : 0
    const max = schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum - 1
      : schema.maximum !== undefined ? schema.maximum : 9999
    return faker.number.int({ min, max })
  }

  // Number / float
  if (type === "number") {
    const min = schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 0.01
      : schema.minimum !== undefined ? schema.minimum : 0
    const max = schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum - 0.01
      : schema.maximum !== undefined ? schema.maximum : 100
    return faker.number.float({ min, max, fractionDigits: 2 })
  }

  // Boolean
  if (type === "boolean") {
    return faker.datatype.boolean()
  }

  // String
  if (type === "string" || !type) {
    // 1. Pattern is the strongest constraint — always prefer it
    if (schema.pattern) {
      try {
        const re = new RandExp(schema.pattern)
        re.max = schema.maxLength ?? 20
        return re.gen()
      } catch {
        // Invalid pattern, fall through to format
      }
    }

    // 2. Known format → faker
    switch (fmt) {
      case "date-time": return faker.date.recent().toISOString()
      case "date": return faker.date.recent().toISOString().split("T")[0]
      case "time": return faker.date.recent().toISOString().split("T")[1]!.replace("Z", "+00:00")
      case "duration": return `P${faker.number.int({ min: 1, max: 30 })}D`
      case "email":
      case "idn-email": return faker.internet.email()
      case "hostname":
      case "idn-hostname": return faker.internet.domainName()
      case "ipv4": return faker.internet.ipv4()
      case "ipv6": return faker.internet.ipv6()
      case "uri":
      case "url": return faker.internet.url()
      case "uri-reference": return `/${faker.lorem.slug()}`
      case "uuid": return faker.string.uuid()
      case "byte": return btoa(faker.string.alphanumeric(12))
      case "binary": return faker.string.alphanumeric(16)
      case "password": return faker.internet.password()
      case "phone":
      case "telephone":
      case "mobile": return faker.phone.number()
    }

    // 3. Plain string with length constraints
    const minLen = schema.minLength ?? 1
    const maxLen = schema.maxLength ?? Math.max(minLen, 20)
    const len = faker.number.int({ min: minLen, max: Math.min(maxLen, 60) })
    return faker.string.alphanumeric(len)
  }

  return undefined
}

function randomizeLeaves(value: unknown, rawSchema: SchemaObject): unknown {
  if (value === null || value === undefined) return value

  const schema = resolveEffectiveSchema(rawSchema)

  // Leaf with enum — pick random
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return faker.helpers.arrayElement(schema.enum as unknown[])
  }

  // Leaf scalar — if schema has explicit example, keep it; otherwise faker
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (schema.example !== undefined || schema.examples) return value
    if (schema.default !== undefined) return value
    const faked = fakerForSchema(schema)
    if (faked !== undefined) return faked
    return value
  }

  // Array
  if (Array.isArray(value) && schema.items) {
    return value.map(item => randomizeLeaves(item, schema.items as SchemaObject))
  }

  // Object
  if (typeof value === "object" && value !== null && schema.properties) {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      const propSchema = schema.properties[key] as SchemaObject | undefined
      result[key] = propSchema ? randomizeLeaves(val, propSchema) : val
    }
    return result
  }

  return value
}

export function generateExample(schema: SchemaObject | null | undefined, _depth: number = 0): unknown {
  if (!schema) return null
  if (schema._circular || schema._unresolved) return null
  try {
    const base = sample(schema as Record<string, unknown>)
    return randomizeLeaves(base, schema)
  } catch {
    return null
  }
}
