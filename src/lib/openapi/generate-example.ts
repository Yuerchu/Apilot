import type { SchemaObject } from "./types"
import { resolveEffectiveSchema } from "./resolve-schema"
import { sample } from "openapi-sampler"
import { faker } from "@faker-js/faker/locale/en"
import RandExp from "randexp"
import { getCountryCallingCode, getExampleNumber, type CountryCode } from "libphonenumber-js"
import phoneExamples from "libphonenumber-js/mobile/examples"

const E164_COUNTRIES: CountryCode[] = ["US", "GB", "CN", "JP", "KR", "DE", "FR", "IN", "AU", "BR"]

function randomE164(): string {
  const country = faker.helpers.arrayElement(E164_COUNTRIES)
  return generatePhoneForCountry(country)
}

export function generateNationalForCountry(country: CountryCode): string {
  const example = getExampleNumber(country, phoneExamples)
  const nationalLen = example ? example.nationalNumber.length : 10
  return faker.string.numeric({ length: nationalLen })
}

export function generatePhoneForCountry(country: CountryCode): string {
  const callingCode = getCountryCallingCode(country)
  return `+${callingCode}${generateNationalForCountry(country)}`
}

function fakerForSchema(schema: SchemaObject): unknown {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type
  const fmt = schema.format

  // Integer
  if (type === "integer") {
    let min = schema.minimum !== undefined ? Number(schema.minimum) : 0
    let max = schema.maximum !== undefined ? Number(schema.maximum) : 9999
    if (typeof schema.exclusiveMinimum === "number") min = schema.exclusiveMinimum + 1
    else if (schema.exclusiveMinimum === true && schema.minimum !== undefined) min = Number(schema.minimum) + 1
    if (typeof schema.exclusiveMaximum === "number") max = schema.exclusiveMaximum - 1
    else if (schema.exclusiveMaximum === true && schema.maximum !== undefined) max = Number(schema.maximum) - 1
    return faker.number.int({ min, max })
  }

  // Number / float
  if (type === "number") {
    let min = schema.minimum !== undefined ? Number(schema.minimum) : 0
    let max = schema.maximum !== undefined ? Number(schema.maximum) : 100
    if (typeof schema.exclusiveMinimum === "number") min = schema.exclusiveMinimum + 0.01
    else if (schema.exclusiveMinimum === true && schema.minimum !== undefined) min = Number(schema.minimum) + 0.01
    if (typeof schema.exclusiveMaximum === "number") max = schema.exclusiveMaximum - 0.01
    else if (schema.exclusiveMaximum === true && schema.maximum !== undefined) max = Number(schema.maximum) - 0.01
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
      case "e164":
      case "e.164": return randomE164()
      case "phone":
      case "telephone":
      case "mobile": {
        const c = faker.helpers.arrayElement(E164_COUNTRIES)
        return generateNationalForCountry(c)
      }
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

export interface RandomVariant {
  id: string
  label: string
}

const PHONE_VARIANTS: RandomVariant[] = [
  { id: "phone-international", label: "+1 (555) 123-4567" },
  { id: "phone-e164", label: "+8613800138000 (E.164)" },
  { id: "phone-digits", label: "13800138000" },
  { id: "phone-cn", label: "138-0013-8000" },
]

const DATETIME_VARIANTS: RandomVariant[] = [
  { id: "dt-recent", label: "Recent (ISO 8601)" },
  { id: "dt-past", label: "Past (ISO 8601)" },
  { id: "dt-future", label: "Future (ISO 8601)" },
  { id: "dt-epoch", label: "Unix timestamp" },
]

const DATE_VARIANTS: RandomVariant[] = [
  { id: "date-recent", label: "Recent" },
  { id: "date-past", label: "Past" },
  { id: "date-future", label: "Future" },
]

const EMAIL_VARIANTS: RandomVariant[] = [
  { id: "email-random", label: "Random email" },
  { id: "email-example", label: "user@example.com" },
]

const UUID_VARIANTS: RandomVariant[] = [
  { id: "uuid-v4", label: "UUID v4" },
  { id: "uuid-nil", label: "Nil UUID" },
]

const STRING_VARIANTS: RandomVariant[] = [
  { id: "str-alpha", label: "Alphanumeric" },
  { id: "str-lorem", label: "Lorem text" },
  { id: "str-slug", label: "slug-format" },
]

export function getRandomVariants(rawSchema: SchemaObject): RandomVariant[] {
  const schema = resolveEffectiveSchema(rawSchema)
  if (schema.enum) return []
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type
  const fmt = schema.format

  if (type === "boolean") return []

  if (type === "string" || !type) {
    if (fmt === "date-time") return DATETIME_VARIANTS
    if (fmt === "date") return DATE_VARIANTS
    if (fmt === "email" || fmt === "idn-email") return EMAIL_VARIANTS
    if (fmt === "uuid") return UUID_VARIANTS
    if (fmt === "phone" || fmt === "telephone" || fmt === "mobile" || fmt === "e164" || fmt === "e.164") return PHONE_VARIANTS
    // Plain string — offer text variants if no pattern
    if (!schema.pattern) return STRING_VARIANTS
  }

  return []
}

export function generateWithVariant(rawSchema: SchemaObject, variantId: string): unknown {
  const schema = resolveEffectiveSchema(rawSchema)
  const minLen = schema.minLength ?? 1
  const maxLen = schema.maxLength ?? Math.max(minLen, 20)

  switch (variantId) {
    // Phone
    case "phone-international": return faker.phone.number({ style: "international" })
    case "phone-e164": return randomE164()
    case "phone-digits": return generateNationalForCountry("CN")
    case "phone-cn": {
      const n = faker.string.numeric(11)
      return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`
    }
    // DateTime
    case "dt-recent": return faker.date.recent().toISOString()
    case "dt-past": return faker.date.past().toISOString()
    case "dt-future": return faker.date.future().toISOString()
    case "dt-epoch": return String(Math.floor(faker.date.recent().getTime() / 1000))
    // Date
    case "date-recent": return faker.date.recent().toISOString().split("T")[0]
    case "date-past": return faker.date.past().toISOString().split("T")[0]
    case "date-future": return faker.date.future().toISOString().split("T")[0]
    // Email
    case "email-random": return faker.internet.email()
    case "email-example": return `user${faker.number.int({ min: 1, max: 999 })}@example.com`
    // UUID
    case "uuid-v4": return faker.string.uuid()
    case "uuid-nil": return "00000000-0000-0000-0000-000000000000"
    // String
    case "str-alpha": return faker.string.alphanumeric(faker.number.int({ min: minLen, max: Math.min(maxLen, 30) }))
    case "str-lorem": return faker.lorem.words(faker.number.int({ min: 1, max: 5 })).slice(0, maxLen)
    case "str-slug": return faker.lorem.slug(faker.number.int({ min: 1, max: 4 })).slice(0, maxLen)
    default: return generateExample(rawSchema)
  }
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
