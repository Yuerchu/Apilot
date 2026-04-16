import { apiCompare } from "api-smart-diff"
import type { Diff } from "api-smart-diff"
import type { OpenAPISpec } from "./types"
import { getOperationKey } from "./parser"

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

const DIFF_KINDS: OpenAPIDiffKind[] = [
  "endpoint-added",
  "endpoint-removed",
  "request-schema-changed",
  "response-schema-changed",
]

function toSeverity(type: Diff["type"]): OpenAPIDiffSeverity {
  if (type === "breaking") return "breaking"
  if (type === "non-breaking") return "non-breaking"
  return "changed"
}

function getPathPart(diff: Diff, index: number): string | null {
  const part = diff.path[index]
  return typeof part === "string" ? part : null
}

function getOperation(diff: Diff): string {
  const path = getPathPart(diff, 1)
  const method = getPathPart(diff, 2)
  return path && method ? getOperationKey(method, path) : "OpenAPI"
}

function getKind(diff: Diff): OpenAPIDiffKind | null {
  const root = getPathPart(diff, 0)
  if (root !== "paths") return null

  const method = getPathPart(diff, 2)
  if (method && diff.path.length === 3) {
    return diff.action === "add" ? "endpoint-added" : diff.action === "remove" ? "endpoint-removed" : null
  }

  if (diff.path.includes("requestBody") || diff.path.includes("parameters")) {
    return "request-schema-changed"
  }

  if (diff.path.includes("responses")) {
    return "response-schema-changed"
  }

  return null
}

function getTitle(kind: OpenAPIDiffKind): string {
  if (kind === "endpoint-added") return "Endpoint added"
  if (kind === "endpoint-removed") return "Endpoint removed"
  if (kind === "request-schema-changed") return "Request schema changed"
  return "Response schema changed"
}

function toMessage(diff: Diff, operation: string): string {
  return diff.description || `${operation}: ${diff.action} ${diff.path.join(".")}`
}

function toChange(diff: Diff, index: number): OpenAPIDiffChange | null {
  const kind = getKind(diff)
  if (!kind) return null
  const operation = getOperation(diff)
  const message = toMessage(diff, operation)
  return {
    id: `${kind}:${operation}:${index}`,
    kind,
    severity: toSeverity(diff.type),
    title: getTitle(kind),
    message,
    operation,
    details: [
      message,
      diff.path.join("."),
    ],
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
  const result = apiCompare(before, after)
  const changes = result.diffs
    .map(toChange)
    .filter((change): change is OpenAPIDiffChange => !!change)

  return {
    changes,
    counts: summarizeChanges(changes),
    byKind: summarizeByKind(changes),
  }
}
