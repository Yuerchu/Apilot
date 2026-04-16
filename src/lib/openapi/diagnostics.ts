import type {
  OpenAPISpec,
  Operation,
  PathItem,
  ResponseObject,
  SchemaObject,
} from "./types"
import { HTTP_METHODS, getOperationKey } from "./parser"

export type OpenAPIDiagnosticSeverity = "error" | "warning" | "info"

export type OpenAPIDiagnosticCode =
  | "unresolved-ref"
  | "duplicate-operation-id"
  | "empty-schema"
  | "missing-response-schema"
  | "missing-description"
  | "enum-missing-description"

export interface OpenAPIDiagnosticIssue {
  id: string
  code: OpenAPIDiagnosticCode
  severity: OpenAPIDiagnosticSeverity
  title: string
  message: string
  location: string
  operation?: string
  model?: string
}

export interface OpenAPIDiagnosticsResult {
  issues: OpenAPIDiagnosticIssue[]
  counts: Record<OpenAPIDiagnosticSeverity, number>
  byCode: Record<OpenAPIDiagnosticCode, number>
  metrics: {
    endpointCount: number
    schemaCount: number
  }
}

type JsonRecord = Record<string, unknown>

const DIAGNOSTIC_CODES: OpenAPIDiagnosticCode[] = [
  "unresolved-ref",
  "duplicate-operation-id",
  "empty-schema",
  "missing-response-schema",
  "missing-description",
  "enum-missing-description",
]

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0
}

function pointerSegment(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1")
}

function makePointer(parts: string[]): string {
  return `#/${parts.map(pointerSegment).join("/")}`
}

function decodePointerSegment(value: string): string {
  return value.replace(/~1/g, "/").replace(/~0/g, "~")
}

function resolveJsonPointer(root: unknown, ref: string): unknown {
  if (ref === "#") return root
  if (!ref.startsWith("#/")) return undefined
  let current: unknown = root
  for (const part of ref.slice(2).split("/").map(decodePointerSegment)) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[part]
    if (current === undefined) return undefined
  }
  return current
}

function walkJson(value: unknown, path: string[], visit: (value: unknown, path: string[]) => void) {
  visit(value, path)
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, [...path, String(index)], visit))
    return
  }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    walkJson(child, [...path, key], visit)
  }
}

function isEmptySchema(schema: SchemaObject): boolean {
  return !schema.$ref
    && schema.type === undefined
    && schema.enum === undefined
    && schema.const === undefined
    && schema.properties === undefined
    && schema.items === undefined
    && schema.allOf === undefined
    && schema.anyOf === undefined
    && schema.oneOf === undefined
    && schema.additionalProperties === undefined
}

function hasEnumExplanation(schema: SchemaObject): boolean {
  return hasText(schema.description)
    || Array.isArray(schema["x-enumDescriptions"])
    || Array.isArray(schema["x-enum-descriptions"])
    || Array.isArray(schema["x-enumNames"])
    || Array.isArray(schema["x-enum-varnames"])
}

function shouldCheckResponseSchema(status: string): boolean {
  return /^2\d\d$/.test(status) && status !== "204" && status !== "304"
}

function responseHasSchema(response: ResponseObject): boolean {
  if (response.schema) return true
  const content = response.content || {}
  return Object.values(content).some(media => !!media.schema)
}

function countOperations(spec: OpenAPISpec): number {
  let count = 0
  for (const pathItem of Object.values(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      if (pathItem[method]) count += 1
    }
  }
  return count
}

function addIssue(
  issues: OpenAPIDiagnosticIssue[],
  issue: Omit<OpenAPIDiagnosticIssue, "id">,
) {
  issues.push({
    ...issue,
    id: `${issue.code}:${issue.location}:${issues.length}`,
  })
}

function contextFields(options: { model?: string; operation?: string }) {
  return {
    ...(options.model ? { model: options.model } : {}),
    ...(options.operation ? { operation: options.operation } : {}),
  }
}

function scanRefs(spec: OpenAPISpec, sourceSpec: OpenAPISpec, issues: OpenAPIDiagnosticIssue[]) {
  walkJson(sourceSpec, [], (value, path) => {
    if (!isRecord(value) || typeof value.$ref !== "string") return
    const ref = value.$ref
    if (!ref.startsWith("#")) return
    if (resolveJsonPointer(sourceSpec, ref) !== undefined) return
    addIssue(issues, {
      code: "unresolved-ref",
      severity: "error",
      title: "Unresolved $ref",
      message: `Reference "${ref}" cannot be resolved.`,
      location: makePointer(path),
    })
  })

  if (sourceSpec !== spec) {
    walkJson(spec, [], (value, path) => {
      if (!isRecord(value) || typeof value._unresolved !== "string") return
      addIssue(issues, {
        code: "unresolved-ref",
        severity: "error",
        title: "Unresolved $ref",
        message: `Reference "${value._unresolved}" cannot be resolved.`,
        location: makePointer(path),
      })
    })
  }
}

function scanSchema(
  schema: SchemaObject | undefined,
  path: string[],
  issues: OpenAPIDiagnosticIssue[],
  options: {
    model?: string
    operation?: string
    requireDescription?: boolean
    label: string
  },
) {
  if (!schema) return
  const location = makePointer(path)

  if (isEmptySchema(schema)) {
    addIssue(issues, {
      code: "empty-schema",
      severity: "warning",
      title: "Empty schema",
      message: `${options.label} has no structural schema fields.`,
      location,
      ...contextFields(options),
    })
  }

  if (options.requireDescription && !hasText(schema.description) && !schema.$ref) {
    addIssue(issues, {
      code: "missing-description",
      severity: "info",
      title: "Missing description",
      message: `${options.label} has no description.`,
      location,
      ...contextFields(options),
    })
  }

  if (schema.enum && !hasEnumExplanation(schema)) {
    addIssue(issues, {
      code: "enum-missing-description",
      severity: "info",
      title: "Enum missing explanation",
      message: `${options.label} defines enum values without an explanation.`,
      location,
      ...contextFields(options),
    })
  }

  if (schema.properties) {
    for (const [name, prop] of Object.entries(schema.properties)) {
      scanSchema(prop, [...path, "properties", name], issues, {
        ...options,
        label: `${options.label}.${name}`,
        requireDescription: true,
      })
    }
  }

  if (schema.items) {
    scanSchema(schema.items, [...path, "items"], issues, {
      ...options,
      label: `${options.label}[]`,
      requireDescription: false,
    })
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    const parts = schema[key]
    if (!parts) continue
    parts.forEach((part, index) => {
      scanSchema(part, [...path, key, String(index)], issues, {
        ...options,
        label: `${options.label}.${key}[${index}]`,
        requireDescription: false,
      })
    })
  }

  if (isRecord(schema.additionalProperties)) {
    scanSchema(schema.additionalProperties as SchemaObject, [...path, "additionalProperties"], issues, {
      ...options,
      label: `${options.label}.additionalProperties`,
      requireDescription: false,
    })
  }
}

function scanDuplicateOperationIds(spec: OpenAPISpec, issues: OpenAPIDiagnosticIssue[]) {
  const seen = new Map<string, Array<{ operation: string; location: string }>>()
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op?.operationId) continue
      const items = seen.get(op.operationId) || []
      items.push({
        operation: getOperationKey(method, path),
        location: makePointer(["paths", path, method, "operationId"]),
      })
      seen.set(op.operationId, items)
    }
  }

  for (const [operationId, items] of seen) {
    if (items.length < 2) continue
    for (const item of items) {
      addIssue(issues, {
        code: "duplicate-operation-id",
        severity: "error",
        title: "Duplicate operationId",
        message: `operationId "${operationId}" is used by ${items.length} operations.`,
        location: item.location,
        operation: item.operation,
      })
    }
  }
}

function scanOperation(
  path: string,
  method: string,
  pathItem: PathItem,
  op: Operation,
  issues: OpenAPIDiagnosticIssue[],
) {
  const operation = getOperationKey(method, path)
  const operationPath = ["paths", path, method]

  if (!hasText(op.summary) && !hasText(op.description)) {
    addIssue(issues, {
      code: "missing-description",
      severity: "info",
      title: "Missing description",
      message: `${operation} has no summary or description.`,
      location: makePointer(operationPath),
      operation,
    })
  }

  const parameters = [...(pathItem.parameters || []), ...(op.parameters || [])]
  parameters.forEach((parameter, index) => {
    if (!hasText(parameter.description)) {
      addIssue(issues, {
        code: "missing-description",
        severity: "info",
        title: "Missing description",
        message: `Parameter "${parameter.name}" has no description.`,
        location: makePointer([...operationPath, "parameters", String(index)]),
        operation,
      })
    }
    scanSchema(parameter.schema, [...operationPath, "parameters", String(index), "schema"], issues, {
      operation,
      label: `${operation} parameter ${parameter.name}`,
    })
  })

  if (op.requestBody?.content) {
    for (const [contentType, media] of Object.entries(op.requestBody.content)) {
      scanSchema(media.schema, [...operationPath, "requestBody", "content", contentType, "schema"], issues, {
        operation,
        label: `${operation} request ${contentType}`,
      })
    }
  }

  for (const [status, response] of Object.entries(op.responses || {})) {
    const responsePath = [...operationPath, "responses", status]
    if (!hasText(response.description)) {
      addIssue(issues, {
        code: "missing-description",
        severity: "info",
        title: "Missing description",
        message: `${operation} response ${status} has no description.`,
        location: makePointer(responsePath),
        operation,
      })
    }

    if (shouldCheckResponseSchema(status) && !responseHasSchema(response)) {
      addIssue(issues, {
        code: "missing-response-schema",
        severity: "warning",
        title: "Missing response schema",
        message: `${operation} response ${status} has no schema.`,
        location: makePointer(responsePath),
        operation,
      })
    }

    if (response.schema) {
      scanSchema(response.schema, [...responsePath, "schema"], issues, {
        operation,
        label: `${operation} response ${status}`,
      })
    }
    for (const [contentType, media] of Object.entries(response.content || {})) {
      scanSchema(media.schema, [...responsePath, "content", contentType, "schema"], issues, {
        operation,
        label: `${operation} response ${status} ${contentType}`,
      })
    }
  }
}

function scanSchemas(spec: OpenAPISpec, issues: OpenAPIDiagnosticIssue[]) {
  const schemas = spec.components?.schemas || spec.definitions || {}
  const schemaPath = spec.components?.schemas ? ["components", "schemas"] : ["definitions"]
  for (const [name, schema] of Object.entries(schemas)) {
    scanSchema(schema, [...schemaPath, name], issues, {
      model: name,
      label: name,
      requireDescription: true,
    })
  }
}

function summarizeIssues(issues: OpenAPIDiagnosticIssue[]): OpenAPIDiagnosticsResult["counts"] {
  return issues.reduce<Record<OpenAPIDiagnosticSeverity, number>>((counts, issue) => {
    counts[issue.severity] += 1
    return counts
  }, { error: 0, warning: 0, info: 0 })
}

function summarizeByCode(issues: OpenAPIDiagnosticIssue[]): OpenAPIDiagnosticsResult["byCode"] {
  const initial = Object.fromEntries(DIAGNOSTIC_CODES.map(code => [code, 0])) as Record<OpenAPIDiagnosticCode, number>
  for (const issue of issues) initial[issue.code] += 1
  return initial
}

export function runOpenAPIDiagnostics(spec: OpenAPISpec, sourceSpec: OpenAPISpec = spec): OpenAPIDiagnosticsResult {
  const issues: OpenAPIDiagnosticIssue[] = []

  scanRefs(spec, sourceSpec, issues)
  scanDuplicateOperationIds(sourceSpec, issues)
  scanSchemas(sourceSpec, issues)

  for (const [path, pathItem] of Object.entries(sourceSpec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue
      scanOperation(path, method, pathItem, op, issues)
    }
  }

  return {
    issues,
    counts: summarizeIssues(issues),
    byCode: summarizeByCode(issues),
    metrics: {
      endpointCount: countOperations(sourceSpec),
      schemaCount: Object.keys(sourceSpec.components?.schemas || sourceSpec.definitions || {}).length,
    },
  }
}
