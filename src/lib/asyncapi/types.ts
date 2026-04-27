import type { SchemaObject, TagInfo } from "@/lib/openapi/types"

// ---- Raw AsyncAPI 3.0 types (for internal use / JSON representation) ----

export interface AsyncAPISpec {
  asyncapi: string
  info: AsyncAPIInfo
  defaultContentType?: string
  servers?: Record<string, AsyncAPIServer>
  channels?: Record<string, AsyncAPIChannel>
  operations?: Record<string, AsyncAPIOperation>
  components?: {
    schemas?: Record<string, SchemaObject>
    messages?: Record<string, AsyncAPIMessage>
    securitySchemes?: Record<string, Record<string, unknown>>
  }
}

export interface AsyncAPIInfo {
  title: string
  version: string
  description?: string
  license?: { name?: string; url?: string; identifier?: string }
  contact?: { name?: string; url?: string; email?: string }
  termsOfService?: string
  externalDocs?: { description?: string; url: string }
}

export interface AsyncAPIServer {
  host: string
  pathname?: string
  protocol: string
  description?: string
  variables?: Record<string, AsyncAPIServerVariable>
}

export interface AsyncAPIServerVariable {
  default?: string
  description?: string
  enum?: string[]
}

export interface AsyncAPIChannel {
  address?: string
  title?: string
  description?: string
  messages?: Record<string, AsyncAPIMessageRef>
  parameters?: Record<string, AsyncAPIParameter>
  servers?: Array<{ $ref: string }>
  bindings?: { ws?: Record<string, unknown> }
}

export interface AsyncAPIMessageRef {
  $ref?: string
  payload?: SchemaObject
  name?: string
  title?: string
  summary?: string
  description?: string
  contentType?: string
  headers?: SchemaObject
}

export interface AsyncAPIMessage {
  name?: string
  title?: string
  summary?: string
  description?: string
  contentType?: string
  payload?: SchemaObject | { $ref?: string }
  headers?: SchemaObject
  tags?: Array<{ name: string }>
}

export interface AsyncAPIOperation {
  action: "send" | "receive"
  channel: { $ref: string }
  title?: string
  summary?: string
  description?: string
  messages?: Array<{ $ref: string }>
  tags?: Array<{ name: string }>
}

export interface AsyncAPIParameter {
  description?: string
  default?: string
  enum?: string[]
  schema?: SchemaObject
}

// ---- Parsed / flattened types for UI consumption ----

export interface ParsedChannel {
  id: string
  address: string
  title: string
  description: string
  parameters: ParsedChannelParam[]
  sendOperations: ParsedOperation[]
  receiveOperations: ParsedOperation[]
  wsBindings: Record<string, unknown> | null
}

export interface ParsedChannelParam {
  name: string
  description: string
}

export interface ParsedOperation {
  id: string
  action: "send" | "receive"
  channelId: string
  title: string
  summary: string
  description: string
  messages: ParsedMessage[]
  tags: string[]
}

export interface ParsedMessage {
  id: string
  name: string
  title: string
  summary: string
  description: string
  payload: SchemaObject | null
  headers: SchemaObject | null
  discriminatorField: string | null
  discriminatorValue: string | null
}

export interface ParsedServerInfo {
  id: string
  host: string
  pathname: string
  protocol: string
  description: string
  url: string
  variables: Record<string, AsyncAPIServerVariable>
}

export interface AsyncAPISpecInfo {
  title: string
  version: string
  description: string
  specVersion: string
  channelCount: number
  operationCount: number
  license?: AsyncAPIInfo["license"]
  contact?: AsyncAPIInfo["contact"]
  termsOfService?: string
  externalDocs?: { description?: string; url: string }
}

export interface ParsedAsyncAPIResult {
  raw: AsyncAPISpec
  channels: ParsedChannel[]
  schemas: Record<string, SchemaObject>
  servers: ParsedServerInfo[]
  info: AsyncAPISpecInfo
  allTags: TagInfo[]
  diagnostics: AsyncAPIDiagnostic[]
}

export interface AsyncAPIDiagnostic {
  severity: "error" | "warning" | "info" | "hint"
  message: string
  path?: string
}
