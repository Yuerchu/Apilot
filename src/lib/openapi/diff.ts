import type {
  OpenAPISpec,
  Operation,
  SchemaObject,
} from "./types"
import { HTTP_METHODS, getOperationKey } from "./parser"

export type OpenAPIDiffSeverity = "breaking" | "changed" | "non-breaking"

export type OpenAPIDiffKind =
  | "endpoint-added"
  | "endpoint-removed"
  | "request-schema-changed"
  | "response-schema-changed"

export interface OpenAPIDiffChange {
  id: string
  kind: OpenAPIDiffKind
  severity: OpenAPIDiffSeverity
  title: string
  message: string
  operation: string
  details: string[]
}

export interface OpenAPIDiffResult {
  changes: OpenAPIDiffChange[]
  counts: Record<OpenAPIDiffSeverity, number>
  byKind: Record<OpenAPIDiffKind, number>
}

interface OperationEntry {
  method: string
  path: string
  operation: Operation
}

type SchemaMap = Record<string, SchemaObject>
type JsonRecord = Record<string, unknown>

const DIFF_KINDS: OpenAPIDiffKind[] = [
  "endpoint-added",
  "endpoint-removed",
  "request-schema-changed",
  "response-schema-changed",
]

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function buildOperationMap(spec: OpenAPISpec): Map<string, OperationEntry> {
  const map = new Map<string, OperationEntry>()
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method]
      if (!operation) continue
      map.set(getOperationKey(method, path), { method, path, operation })
    }
  }
  return map
}

function normalizeSchema(schema: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(schema)) return schema.map(item => normalizeSchema(item, seen))
  if (!isRecord(schema)) return schema
  if (seen.has(schema)) return "[Circular]"
  seen.add(schema)

  const entries: Array<[string, unknown]> = Object.entries(schema)
    .filter(([key]) => {
      if (key.startsWith("_")) return false
      if (key.startsWith("x-")) return false
      return ![
        "description",
        "title",
        "summary",
        "example",
        "examples",
        "default",
        "deprecated",
        "externalDocs",
      ].includes(key)
    })
    .map(([key, value]): [string, unknown] => {
      if (key === "required" && Array.isArray(value)) {
        return [key, [...value].sort()]
      }
      if (key === "enum" && Array.isArray(value)) {
        return [key, [...value].sort((a, b) => String(JSON.stringify(a)).localeCompare(String(JSON.stringify(b))))]
      }
      return [key, normalizeSchema(value, seen)]
    })
    .sort((left, right) => left[0].localeCompare(right[0]))

  return Object.fromEntries(entries)
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeSchema(value))
}

function getSchemaType(schema: SchemaObject | undefined): string {
  if (!schema) return "any"
  if (Array.isArray(schema.type)) return schema.type.slice().sort().join("|")
  if (schema.type) return schema.type
  if (schema.properties) return "object"
  if (schema.items) return "array"
  if (schema.enum) return "enum"
  if (schema.allOf) return "allOf"
  if (schema.anyOf) return "anyOf"
  if (schema.oneOf) return "oneOf"
  return "any"
}

function getProperties(schema: SchemaObject | undefined): Record<string, SchemaObject> {
  return schema?.properties || {}
}

function getRequired(schema: SchemaObject | undefined): Set<string> {
  return new Set(schema?.required || [])
}

function getEnumValues(schema: SchemaObject | undefined): Set<string> {
  return new Set((schema?.enum || []).map(value => JSON.stringify(value)))
}

function collectBreakingReasons(
  before: SchemaObject | undefined,
  after: SchemaObject | undefined,
  mode: "request" | "response",
  path = "$",
  reasons: string[] = [],
): string[] {
  if (!before || !after) return reasons

  const beforeType = getSchemaType(before)
  const afterType = getSchemaType(after)
  if (beforeType !== afterType) {
    reasons.push(`${path}: type changed from ${beforeType} to ${afterType}`)
  }

  const beforeEnum = getEnumValues(before)
  const afterEnum = getEnumValues(after)
  for (const value of beforeEnum) {
    if (!afterEnum.has(value)) {
      reasons.push(`${path}: enum value ${value} was removed`)
    }
  }

  const beforeRequired = getRequired(before)
  const afterRequired = getRequired(after)
  if (mode === "request") {
    for (const field of afterRequired) {
      if (!beforeRequired.has(field)) {
        reasons.push(`${path}.${field}: required request field was added`)
      }
    }
  } else {
    for (const field of beforeRequired) {
      if (!afterRequired.has(field)) {
        reasons.push(`${path}.${field}: required response field was removed`)
      }
    }
  }

  const beforeProps = getProperties(before)
  const afterProps = getProperties(after)
  for (const [name, beforeProp] of Object.entries(beforeProps)) {
    const afterProp = afterProps[name]
    if (!afterProp) {
      if (mode === "response") reasons.push(`${path}.${name}: response field was removed`)
      continue
    }
    collectBreakingReasons(beforeProp, afterProp, mode, `${path}.${name}`, reasons)
  }

  if (before.items && after.items) {
    collectBreakingReasons(before.items, after.items, mode, `${path}[]`, reasons)
  }

  return reasons
}

function collectRequestSchemas(operation: Operation): SchemaMap {
  const schemas: SchemaMap = {}
  for (const [contentType, media] of Object.entries(operation.requestBody?.content || {})) {
    if (media.schema) schemas[contentType] = media.schema
  }
  return schemas
}

function collectResponseSchemas(operation: Operation): SchemaMap {
  const schemas: SchemaMap = {}
  for (const [status, response] of Object.entries(operation.responses || {})) {
    if (response.schema) schemas[`${status} schema`] = response.schema
    for (const [contentType, media] of Object.entries(response.content || {})) {
      if (media.schema) schemas[`${status} ${contentType}`] = media.schema
    }
  }
  return schemas
}

function collectResponseStatuses(operation: Operation): Set<string> {
  return new Set(Object.keys(operation.responses || {}).filter(status => /^2\d\d$/.test(status)))
}

function addChange(
  changes: OpenAPIDiffChange[],
  change: Omit<OpenAPIDiffChange, "id">,
) {
  changes.push({
    ...change,
    id: `${change.kind}:${change.operation}:${changes.length}`,
  })
}

function compareSchemaMaps(
  changes: OpenAPIDiffChange[],
  operation: string,
  kind: "request-schema-changed" | "response-schema-changed",
  beforeSchemas: SchemaMap,
  afterSchemas: SchemaMap,
) {
  for (const [key, beforeSchema] of Object.entries(beforeSchemas)) {
    const afterSchema = afterSchemas[key]
    if (!afterSchema) {
      addChange(changes, {
        kind,
        severity: "breaking",
        title: kind === "request-schema-changed" ? "Request schema changed" : "Response schema changed",
        message: `${operation} ${key} schema was removed.`,
        operation,
        details: [`${key}: schema removed`],
      })
      continue
    }

    if (stableStringify(beforeSchema) === stableStringify(afterSchema)) continue

    const mode = kind === "request-schema-changed" ? "request" : "response"
    const details = collectBreakingReasons(beforeSchema, afterSchema, mode)
    addChange(changes, {
      kind,
      severity: details.length ? "breaking" : "changed",
      title: kind === "request-schema-changed" ? "Request schema changed" : "Response schema changed",
      message: `${operation} ${key} schema changed.`,
      operation,
      details: details.length ? details : [`${key}: schema structure changed`],
    })
  }

  for (const key of Object.keys(afterSchemas)) {
    if (beforeSchemas[key]) continue
    addChange(changes, {
      kind,
      severity: kind === "request-schema-changed" ? "breaking" : "non-breaking",
      title: kind === "request-schema-changed" ? "Request schema changed" : "Response schema changed",
      message: `${operation} ${key} schema was added.`,
      operation,
      details: [`${key}: schema added`],
    })
  }
}

function compareResponseStatuses(
  changes: OpenAPIDiffChange[],
  operation: string,
  beforeOperation: Operation,
  afterOperation: Operation,
) {
  const beforeStatuses = collectResponseStatuses(beforeOperation)
  const afterStatuses = collectResponseStatuses(afterOperation)
  for (const status of beforeStatuses) {
    if (afterStatuses.has(status)) continue
    addChange(changes, {
      kind: "response-schema-changed",
      severity: "breaking",
      title: "Response schema changed",
      message: `${operation} response ${status} was removed.`,
      operation,
      details: [`${status}: response removed`],
    })
  }
}

function summarizeChanges(changes: OpenAPIDiffChange[]): OpenAPIDiffResult["counts"] {
  return changes.reduce<Record<OpenAPIDiffSeverity, number>>((counts, change) => {
    counts[change.severity] += 1
    return counts
  }, { breaking: 0, changed: 0, "non-breaking": 0 })
}

function summarizeByKind(changes: OpenAPIDiffChange[]): OpenAPIDiffResult["byKind"] {
  const initial = Object.fromEntries(DIFF_KINDS.map(kind => [kind, 0])) as Record<OpenAPIDiffKind, number>
  for (const change of changes) initial[change.kind] += 1
  return initial
}

export function diffOpenAPISpecs(before: OpenAPISpec, after: OpenAPISpec): OpenAPIDiffResult {
  const changes: OpenAPIDiffChange[] = []
  const beforeOps = buildOperationMap(before)
  const afterOps = buildOperationMap(after)

  for (const [operation, beforeEntry] of beforeOps) {
    const afterEntry = afterOps.get(operation)
    if (!afterEntry) {
      addChange(changes, {
        kind: "endpoint-removed",
        severity: "breaking",
        title: "Endpoint removed",
        message: `${operation} was removed.`,
        operation,
        details: [`${beforeEntry.method.toUpperCase()} ${beforeEntry.path}`],
      })
      continue
    }

    compareResponseStatuses(changes, operation, beforeEntry.operation, afterEntry.operation)
    compareSchemaMaps(
      changes,
      operation,
      "request-schema-changed",
      collectRequestSchemas(beforeEntry.operation),
      collectRequestSchemas(afterEntry.operation),
    )
    compareSchemaMaps(
      changes,
      operation,
      "response-schema-changed",
      collectResponseSchemas(beforeEntry.operation),
      collectResponseSchemas(afterEntry.operation),
    )
  }

  for (const [operation, afterEntry] of afterOps) {
    if (beforeOps.has(operation)) continue
    addChange(changes, {
      kind: "endpoint-added",
      severity: "non-breaking",
      title: "Endpoint added",
      message: `${operation} was added.`,
      operation,
      details: [`${afterEntry.method.toUpperCase()} ${afterEntry.path}`],
    })
  }

  return {
    changes,
    counts: summarizeChanges(changes),
    byKind: summarizeByKind(changes),
  }
}
