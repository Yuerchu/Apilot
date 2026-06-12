import type { SchemaObject, ParsedRoute } from "@/lib/openapi/types"

/**
 * Find the first top-level property of a multipart schema that represents a file
 * (format binary/base64) — the field name uploads must use instead of guessing "file".
 */
export function findBinaryFieldName(schema: SchemaObject | null | undefined): string | null {
  if (!schema?.properties) return null
  for (const [key, prop] of Object.entries(schema.properties)) {
    const fmt = (prop as SchemaObject).format
    if (fmt === "binary" || fmt === "base64") return key
  }
  return null
}

const PASSWORD_NAME = /pass(word)?|pwd/i
const CONFIRM_NAME = /confirm|repeat|again|re_?type|2$/i

/**
 * Detect a primary + confirm password field pair for client-side equality validation.
 * Only returns a pair when there is exactly one password-like field whose name also
 * marks it as a confirmation, plus a distinct primary password field. Anything
 * ambiguous returns null (validation silently skipped).
 */
export function detectConfirmPasswordPair(schema: SchemaObject | null | undefined): { primary: string; confirm: string } | null {
  if (!schema?.properties) return null

  const passwordFields = Object.entries(schema.properties)
    .filter(([name, prop]) => (prop as SchemaObject).format === "password" || PASSWORD_NAME.test(name))
    .map(([name]) => name)

  if (passwordFields.length < 2) return null

  const confirms = passwordFields.filter(name => CONFIRM_NAME.test(name))
  if (confirms.length !== 1) return null
  const confirm = confirms[0]!

  const primaries = passwordFields.filter(name => name !== confirm)
  if (primaries.length !== 1) return null

  return { primary: primaries[0]!, confirm }
}

const DANGEROUS_PATH = /delete|remove|purge|clear|reset|revoke|destroy/i

/** A no-body action that should ask for confirmation before executing. */
export function isDangerousAction(route: ParsedRoute): boolean {
  if (route.method.toLowerCase() === "delete") return true
  return DANGEROUS_PATH.test(route.path)
}

/** Deep equality that ignores object key order (for dirty-state tracking). */
export function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== "object" || a === null || b === null) return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => stableEqual(item, (b as unknown[])[i]))
  }
  if (Array.isArray(b)) return false

  const aKeys = Object.keys(a as Record<string, unknown>)
  const bKeys = Object.keys(b as Record<string, unknown>)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(k =>
    Object.prototype.hasOwnProperty.call(b, k)
    && stableEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  )
}
