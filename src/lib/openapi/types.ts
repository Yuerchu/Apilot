export interface OpenAPISpec {
  openapi?: string
  swagger?: string
  info?: { title?: string; version?: string; description?: string }
  servers?: ServerObject[]
  paths?: Record<string, PathItem>
  components?: {
    schemas?: Record<string, SchemaObject>
    securitySchemes?: Record<string, SecurityScheme>
  }
  definitions?: Record<string, SchemaObject>
  security?: SecurityRequirement[]
  host?: string
  basePath?: string
  schemes?: string[]
  produces?: string[]
  consumes?: string[]
  securityDefinitions?: Record<string, SecurityScheme>
}

export interface ServerObject {
  url: string
  description?: string
  variables?: Record<string, { default: string; enum?: string[] }>
}

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
  in: 'query' | 'header' | 'path' | 'cookie' | 'body' | 'formData'
  required?: boolean
  description?: string
  schema?: SchemaObject
  type?: string
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

export interface SchemaObject {
  type?: string | string[]
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
  'x-nullable'?: boolean
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
  /** model name → route indices that reference it */
  modelToRoutes: Record<string, number[]>
  /** route index → model names it references */
  routeToModels: Record<number, string[]>
}

export type AuthType = "none" | "bearer" | "basic" | "apikey" | "oauth2"

export type MainView = "endpoints" | "models"

export interface RequestResponse {
  status: number
  statusText: string
  elapsed: number
  headers: Record<string, string>
  body: string
  curlCommand: string
}

export interface ValidationError {
  field: string
  message: string
}

export interface TagInfo {
  name: string
  count: number
}
