import Ajv from "ajv"
import addFormats from "ajv-formats"
import type { SchemaObject } from "@/lib/openapi/types"

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: true })
addFormats(ajv)

export interface SchemaValidationError {
  field: string
  message: string
}

/**
 * Validate data against an OpenAPI schema using ajv.
 * Returns an array of field-level errors (empty if valid).
 */
export function validateWithSchema(
  schema: SchemaObject | null | undefined,
  data: unknown,
): SchemaValidationError[] {
  if (!schema) return []

  // Strip internal markers that ajv doesn't understand
  const cleanSchema = stripInternalFields(schema)

  try {
    const validate = ajv.compile(cleanSchema)
    const valid = validate(data)
    if (valid) return []

    return (validate.errors || []).map(err => {
      const field = err.instancePath
        ? err.instancePath.replace(/^\//, "").replace(/\//g, ".")
        : err.params && "missingProperty" in err.params
          ? String(err.params.missingProperty)
          : ""
      return {
        field,
        message: formatErrorMessage(field, err),
      }
    })
  } catch {
    return []
  }
}

function formatErrorMessage(field: string, err: { message?: string; keyword: string; params?: Record<string, unknown> }): string {
  const name = field || "value"
  switch (err.keyword) {
    case "required":
      return `"${err.params?.missingProperty || name}" is required`
    case "minLength":
      return `"${name}" is too short (min ${err.params?.limit})`
    case "maxLength":
      return `"${name}" is too long (max ${err.params?.limit})`
    case "pattern":
      return `"${name}" does not match pattern`
    case "format":
      return `"${name}" invalid format (${err.params?.format})`
    case "minimum":
      return `"${name}" must be >= ${err.params?.limit}`
    case "maximum":
      return `"${name}" must be <= ${err.params?.limit}`
    case "enum":
      return `"${name}" must be one of allowed values`
    case "type":
      return `"${name}" must be ${err.params?.type}`
    default:
      return err.message || `"${name}" is invalid`
  }
}

function stripInternalFields(schema: SchemaObject): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k.startsWith("_")) continue
    if (k === "properties" && v && typeof v === "object") {
      const props: Record<string, unknown> = {}
      for (const [pk, pv] of Object.entries(v as Record<string, SchemaObject>)) {
        props[pk] = stripInternalFields(pv)
      }
      result[k] = props
    } else if (k === "items" && v && typeof v === "object" && !Array.isArray(v)) {
      result[k] = stripInternalFields(v as SchemaObject)
    } else if ((k === "allOf" || k === "anyOf" || k === "oneOf") && Array.isArray(v)) {
      result[k] = v.map(s => stripInternalFields(s as SchemaObject))
    } else {
      result[k] = v
    }
  }
  return result
}
