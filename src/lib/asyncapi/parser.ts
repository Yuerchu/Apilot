import type { SchemaObject, TagInfo } from "@/lib/openapi/types"
import type {
  ParsedChannel,
  ParsedOperation,
  ParsedMessage,
  ParsedServerInfo,
  ParsedAsyncAPIResult,
  AsyncAPISpec,
  AsyncAPIDiagnostic,
} from "./types"

/**
 * Quick spec type detection without full parsing.
 * Checks the first ~300 chars for "asyncapi" keyword.
 */
export function detectSpecType(input: string | Record<string, unknown>): "openapi" | "asyncapi" {
  if (typeof input === "object") {
    return "asyncapi" in input ? "asyncapi" : "openapi"
  }
  const head = input.slice(0, 300)
  if (head.startsWith("{")) {
    return /"asyncapi"\s*:/.test(head) ? "asyncapi" : "openapi"
  }
  return /^asyncapi\s*:/m.test(head) ? "asyncapi" : "openapi"
}

/**
 * Parse an AsyncAPI spec using @asyncapi/parser (dynamically imported).
 * Returns flattened, UI-ready structures.
 */
export async function parseAsyncAPIDocument(input: string): Promise<ParsedAsyncAPIResult> {
  const { Parser } = await import("@asyncapi/parser")
  const parser = new Parser()
  const { document, diagnostics: rawDiags } = await parser.parse(input)

  const diagnostics: AsyncAPIDiagnostic[] = rawDiags.map(d => ({
    severity: d.severity === 0 ? "error" : d.severity === 1 ? "warning" : d.severity === 2 ? "info" : "hint",
    message: d.message,
    path: d.path?.join("."),
  }))

  if (!document) {
    const errors = diagnostics.filter(d => d.severity === "error")
    const msg = errors.length > 0
      ? errors.map(e => e.message).join("\n")
      : "Failed to parse AsyncAPI document"
    throw new Error(msg)
  }

  // Extract raw JSON for storage
  const raw = document.json<AsyncAPISpec>()

  // Servers
  const servers: ParsedServerInfo[] = []
  for (const server of document.servers()) {
    const variables: Record<string, { default?: string; description?: string; enum?: string[] }> = {}
    for (const v of server.variables()) {
      const vJson = v.json() as Record<string, unknown>
      const entry: { default?: string; description?: string; enum?: string[] } = {}
      if (typeof vJson.default === "string") entry.default = vJson.default
      if (typeof vJson.description === "string") entry.description = vJson.description
      if (Array.isArray(vJson.enum)) entry.enum = vJson.enum as string[]
      variables[v.id()] = entry
    }
    const pathname = server.pathname() ?? ""
    servers.push({
      id: server.id(),
      host: server.host(),
      pathname,
      protocol: server.protocol(),
      description: server.description() ?? "",
      url: buildServerUrl(server.protocol(), server.host(), pathname, variables),
      variables,
    })
  }

  // Schemas
  const schemas: Record<string, SchemaObject> = {}
  if (document.components()) {
    for (const schema of document.components().schemas()) {
      schemas[schema.id()] = schema.json() as SchemaObject
    }
  }

  // Build operation map: operationId → ParsedOperation
  const operationMap = new Map<string, ParsedOperation>()
  const opToChannel = new Map<string, string>()
  const tagSet = new Map<string, number>()

  for (const op of document.operations()) {
    const opId = op.id() ?? `op_${operationMap.size}`
    const channels = op.channels()
    const channelId = channels.length > 0 ? channels[0]!.id() : ""
    const messages = extractMessages(op.messages(), tagSet)
    const tags: string[] = []
    for (const tag of op.tags()) {
      const name = tag.name()
      tags.push(name)
      tagSet.set(name, (tagSet.get(name) ?? 0) + 1)
    }
    const opJson = op.json() as Record<string, unknown>
    const parsed: ParsedOperation = {
      id: opId,
      action: op.isSend() ? "send" : "receive",
      channelId,
      title: (opJson.title as string) ?? opId,
      summary: op.summary() ?? "",
      description: op.description() ?? "",
      messages,
      tags,
    }
    operationMap.set(opId, parsed)
    opToChannel.set(opId, channelId)
  }

  // Channels
  const channels: ParsedChannel[] = []
  for (const ch of document.channels()) {
    const params: Array<{ name: string; description: string }> = []
    for (const p of ch.parameters()) {
      params.push({
        name: p.id(),
        description: p.description() ?? "",
      })
    }

    const sendOps: ParsedOperation[] = []
    const receiveOps: ParsedOperation[] = []
    for (const op of ch.operations()) {
      const parsed = operationMap.get(op.id() ?? "")
      if (!parsed) continue
      if (parsed.action === "send") sendOps.push(parsed)
      else receiveOps.push(parsed)
    }

    let wsBindings: Record<string, unknown> | null = null
    try {
      const bindings = ch.bindings()
      for (const b of bindings) {
        if (b.protocol() === "ws") {
          wsBindings = b.json() as Record<string, unknown>
          break
        }
      }
    } catch {
      // bindings may not exist
    }

    const chJson = ch.json() as Record<string, unknown> | undefined
    const titleVal = chJson?.title as string | undefined

    channels.push({
      id: ch.id(),
      address: ch.address() ?? "",
      title: titleVal ?? ch.id(),
      description: ch.description() ?? "",
      parameters: params,
      sendOperations: sendOps,
      receiveOperations: receiveOps,
      wsBindings,
    })
  }

  // Tags
  const allTags: TagInfo[] = Array.from(tagSet.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Info
  const docInfo = document.info()
  const infoJson = docInfo.json() as Record<string, unknown>

  const result: ParsedAsyncAPIResult = {
    raw,
    channels,
    schemas,
    servers,
    info: {
      title: docInfo.title(),
      version: docInfo.version(),
      description: docInfo.description() ?? "",
      specVersion: document.version(),
      channelCount: channels.length,
      operationCount: operationMap.size,
    },
    allTags,
    diagnostics,
  }
  if (infoJson.license) result.info.license = infoJson.license as ParsedAsyncAPIResult["info"]["license"]
  if (infoJson.contact) result.info.contact = infoJson.contact as ParsedAsyncAPIResult["info"]["contact"]
  if (typeof infoJson.termsOfService === "string") result.info.termsOfService = infoJson.termsOfService
  if (infoJson.externalDocs) result.info.externalDocs = infoJson.externalDocs as { description?: string; url: string }

  return result
}

// ---- Helpers ----

function buildServerUrl(
  protocol: string,
  host: string,
  pathname: string | undefined,
  variables: Record<string, { default?: string }>,
): string {
  let url = `${protocol}://${host}${pathname ?? ""}`
  for (const [key, v] of Object.entries(variables)) {
    if (v.default) {
      url = url.replace(`{${key}}`, v.default)
    }
  }
  return url
}

interface MessageLike {
  id(): string
  hasPayload(): boolean
  payload(): { json(): unknown } | undefined
  summary(): string | undefined
  description(): string | undefined
  json(): Record<string, unknown>
}

interface MessageCollection {
  [Symbol.iterator](): Iterator<MessageLike>
}

function extractMessages(messages: MessageCollection, tagSet: Map<string, number>): ParsedMessage[] {
  const result: ParsedMessage[] = []
  for (const msg of messages) {
    const json = msg.json()
    const payload = msg.hasPayload() ? (msg.payload()!.json() as SchemaObject) : null

    // Detect discriminator
    const { field: discriminatorField, value: discriminatorValue } = detectDiscriminator(payload, json)

    // Extract tags from message if available
    const msgTags = json.tags as Array<{ name: string }> | undefined
    if (msgTags) {
      for (const tag of msgTags) {
        tagSet.set(tag.name, (tagSet.get(tag.name) ?? 0) + 1)
      }
    }

    result.push({
      id: msg.id(),
      name: (json.name as string) ?? msg.id(),
      title: (json.title as string) ?? (json.name as string) ?? msg.id(),
      summary: msg.summary() ?? "",
      description: msg.description() ?? "",
      payload,
      headers: json.headers as SchemaObject | null ?? null,
      discriminatorField,
      discriminatorValue,
    })
  }
  return result
}

/**
 * Detect discriminator field from a message payload.
 * Strategy:
 * 1. Check for explicit `discriminator` keyword in the schema
 * 2. For `oneOf` schemas, look for a property with `const` across all variants
 */
function detectDiscriminator(
  payload: SchemaObject | null,
  messageJson: Record<string, unknown>,
): { field: string | null; value: string | null } {
  if (!payload) return { field: null, value: null }

  // Check explicit discriminator
  if (payload.discriminator && typeof payload.discriminator === "string") {
    return { field: payload.discriminator, value: null }
  }

  // For non-union payloads, check if the payload itself has a `type` field with `const`
  if (payload.properties) {
    for (const [key, prop] of Object.entries(payload.properties)) {
      if (prop.const !== undefined) {
        return { field: key, value: String(prop.const) }
      }
    }
  }

  // For oneOf / anyOf, find common discriminator across variants
  const variants = payload.oneOf ?? payload.anyOf
  if (variants && variants.length > 0) {
    // Find property that has `const` in all variants
    const firstVariant = variants[0]
    if (firstVariant?.properties) {
      for (const key of Object.keys(firstVariant.properties)) {
        const allHaveConst = variants.every(v =>
          v.properties?.[key]?.const !== undefined
        )
        if (allHaveConst) {
          return { field: key, value: null }
        }
      }
    }
  }

  // Fallback: check message-level type hint
  const msgName = messageJson.name as string | undefined
  if (msgName) {
    return { field: null, value: msgName }
  }

  return { field: null, value: null }
}

/**
 * Resolve a server URL by substituting variables.
 */
export function resolveServerUrl(
  server: ParsedServerInfo,
  overrides?: Record<string, string>,
): string {
  let url = `${server.protocol}://${server.host}${server.pathname}`
  for (const [key, v] of Object.entries(server.variables)) {
    const value = overrides?.[key] ?? v.default ?? ""
    url = url.replace(`{${key}}`, value)
  }
  return url
}
