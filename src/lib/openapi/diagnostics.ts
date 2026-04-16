import { createConfig, lintFromString } from "@redocly/openapi-core"
import type { OpenAPISpec, Operation, PathItem, ResponseObject, SchemaObject } from "./types"
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

type RedoclyProblem = Awaited<ReturnType<typeof lintFromString>>[number]

const DIAGNOSTIC_CODES: OpenAPIDiagnosticCode[] = [
  "unresolved-ref",
  "duplicate-operation-id",
  "empty-schema",
  "missing-response-schema",
  "missing-description",
  "enum-missing-description",
]

let configPromise: ReturnType<typeof createConfig> | null = null

function getDiagnosticsConfig() {
  configPromise ??= createConfig({
    extends: ["minimal"],
    rules: {
      "no-empty-servers": "off",
      "operation-summary": "off",
      "operation-description": "warn",
      "parameter-description": "warn",
      "operation-operationId-unique": "error",
    },
  })
  return configPromise
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

function countOperations(spec: OpenAPISpec): number {
  let count = 0
  for (const pathItem of Object.values(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      if (pathItem[method]) count += 1
    }
  }
  return count
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

function getPrimaryLocation(problem: RedoclyProblem): string {
  const location = problem.location[0]
  return location?.pointer || "#"
}

function getProblemOperation(pointer: string): string | undefined {
  const match = pointer.match(/^#\/paths\/((?:~1|~0|[^/])+)\/(get|post|put|patch|delete|head|options)\b/)
  if (!match?.[1] || !match[2]) return undefined
  const path = match[1].replace(/~1/g, "/").replace(/~0/g, "~")
  return getOperationKey(match[2], path)
}

function mapRedoclyCode(ruleId: string): OpenAPIDiagnosticCode | null {
  if (ruleId === "no-unresolved-refs") return "unresolved-ref"
  if (ruleId === "operation-operationId-unique") return "duplicate-operation-id"
  if (ruleId === "operation-description" || ruleId === "parameter-description") return "missing-description"
  return null
}

function mapRedoclySeverity(severity: RedoclyProblem["severity"]): OpenAPIDiagnosticSeverity {
  return severity === "error" ? "error" : "warning"
}

function redoclyProblemToIssue(problem: RedoclyProblem, index: number): OpenAPIDiagnosticIssue | null {
  const code = mapRedoclyCode(problem.ruleId)
  if (!code) return null
  const location = getPrimaryLocation(problem)
  const operation = getProblemOperation(location)
  return {
    id: `redocly:${problem.ruleId}:${location}:${index}`,
    code,
    severity: mapRedoclySeverity(problem.severity),
    title: problem.ruleId,
    message: problem.message,
    location,
    ...(operation ? { operation } : {}),
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
    })
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    const parts = schema[key]
    if (!parts) continue
    parts.forEach((part, index) => {
      scanSchema(part, [...path, key, String(index)], issues, {
        ...options,
        label: `${options.label}.${key}[${index}]`,
      })
    })
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    scanSchema(schema.additionalProperties, [...path, "additionalProperties"], issues, {
      ...options,
      label: `${options.label}.additionalProperties`,
    })
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
  const parameters = [...(pathItem.parameters || []), ...(op.parameters || [])]

  parameters.forEach((parameter, index) => {
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

function scanSupplementalRules(spec: OpenAPISpec): OpenAPIDiagnosticIssue[] {
  const issues: OpenAPIDiagnosticIssue[] = []
  const schemas = spec.components?.schemas || spec.definitions || {}
  const schemaPath = spec.components?.schemas ? ["components", "schemas"] : ["definitions"]

  for (const [name, schema] of Object.entries(schemas)) {
    scanSchema(schema, [...schemaPath, name], issues, {
      model: name,
      label: name,
      requireDescription: true,
    })
  }

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue
      scanOperation(path, method, pathItem, op, issues)
    }
  }

  return issues
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

export async function runOpenAPIDiagnostics(_spec: OpenAPISpec, sourceSpec: OpenAPISpec = _spec): Promise<OpenAPIDiagnosticsResult> {
  const config = await getDiagnosticsConfig()
  const problems = await lintFromString({
    source: JSON.stringify(sourceSpec),
    absoluteRef: "openapi.json",
    config,
  })
  const issues = [
    ...problems.map(redoclyProblemToIssue).filter((issue): issue is OpenAPIDiagnosticIssue => !!issue),
    ...scanSupplementalRules(sourceSpec),
  ]

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
