import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types"

// Re-export standard types for convenience
export type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export type OpenAPISchemaType =
  | "array"
  | "boolean"
  | "integer"
  | "null"
  | "number"
  | "object"
  | "string"
  | "file"

export interface OpenAPIInfo extends Record<string, unknown> {
  title?: string
  summary?: string
  version?: string
  description?: string
  license?: unknown
  contact?: unknown
  termsOfService?: string
}

// Extended spec type that also covers Swagger 2.0 fields (post-conversion)
export interface OpenAPISpec {
  openapi?: string
  swagger?: string
  info?: OpenAPIInfo
  servers?: ServerObject[]
  paths?: Record<string, PathItem>
  components?: {
    schemas?: Record<string, SchemaObject>
    securitySchemes?: Record<string, SecurityScheme>
  }
  externalDocs?: { description?: string; url: string }
  definitions?: Record<string, SchemaObject>
  security?: SecurityRequirement[]
  host?: string
  basePath?: string
  schemes?: string[]
  produces?: string[]
  consumes?: string[]
  securityDefinitions?: Record<string, SecurityScheme>
}

export type ServerObject = OpenAPIV3.ServerObject

export interface PathItem {
  get?: Operation
  post?: Operation
  put?: Operation
  patch?: Operation
  delete?: Operation
  head?: Operation
  options?: Operation
  parameters?: Parameter[]
}

export interface Operation {
  tags?: string[]
  summary?: string
  description?: string
  operationId?: string
  parameters?: Parameter[]
  requestBody?: RequestBody
  responses?: Record<string, ResponseObject>
  security?: SecurityRequirement[]
  consumes?: string[]
  produces?: string[]
}

export interface Parameter {
  name: string
  in: "query" | "header" | "path" | "cookie" | "body" | "formData"
  required?: boolean
  description?: string
  schema?: SchemaObject
  type?: OpenAPISchemaType
  format?: string
  enum?: unknown[]
  default?: unknown
}

export interface RequestBody {
  required?: boolean
  description?: string
  content?: Record<string, MediaTypeObject>
}

export interface MediaTypeObject {
  schema?: SchemaObject
  example?: unknown
}

// Extended schema with internal marker fields
export interface SchemaObject extends Record<string, unknown> {
  type?: OpenAPISchemaType | OpenAPISchemaType[]
  format?: string
  title?: string
  description?: string
  properties?: Record<string, SchemaObject>
  required?: string[]
  items?: SchemaObject
  enum?: unknown[]
  const?: unknown
  default?: unknown
  example?: unknown
  nullable?: boolean
  "x-nullable"?: boolean
  allOf?: SchemaObject[]
  anyOf?: SchemaObject[]
  oneOf?: SchemaObject[]
  $ref?: string
  additionalProperties?: boolean | SchemaObject
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  // Internal markers (set by resolveRef)
  _circular?: string
  _unresolved?: string
  _nullable?: boolean
}

export interface ResponseObject {
  description?: string
  content?: Record<string, MediaTypeObject>
  schema?: SchemaObject
}

export interface SecurityScheme {
  type: string
  name?: string
  in?: string
  scheme?: string
  bearerFormat?: string
  flows?: {
    password?: { tokenUrl?: string; scopes?: Record<string, string> }
    clientCredentials?: { tokenUrl?: string; scopes?: Record<string, string> }
    authorizationCode?: { authorizationUrl?: string; tokenUrl?: string; scopes?: Record<string, string> }
    implicit?: { authorizationUrl?: string; scopes?: Record<string, string> }
  }
}

export type SecurityRequirement = Record<string, string[]>

// ---- Application-level types ----

export interface ParsedRoute {
  method: string
  path: string
  tags: string[]
  summary: string
  description: string
  operationId: string
  parameters: Parameter[]
  requestBody: RequestBody | null
  responses: Record<string, ResponseObject>
  security: SecurityRequirement[]
  selected: boolean
  referencedModels: string[]
}

export interface ModelRouteMap {
  modelToRoutes: Record<string, number[]>
  routeToModels: Record<number, string[]>
}

export type AuthType = "none" | "bearer" | "basic" | "apikey" | "oauth2"

export type MainView = "endpoints" | "models" | "schemas" | "diagnostics" | "diff"
export type EndpointDetailTab = "doc" | "try"
export type ModelViewMode = "list" | "graph"
export type SchemaViewerSource = "openapi" | "external"

export interface RequestResponse {
  status: number
  statusText: string
  elapsed: number
  headers: Record<string, string>
  body: string
  curlCommand: string
  // Stored for snippet regeneration in different languages
  requestMethod: string
  requestUrl: string
  requestHeaders: Record<string, string>
  requestBody: string | null
}

export interface ValidationError {
  field: string
  message: string
}

export interface TagInfo {
  name: string
  count: number
}
