import {
  compileErrors,
  dereference,
  parse as parseOpenAPIDocument,
  validate,
} from "@readme/openapi-parser"
import type { ParserOptions, ValidationResult } from "@readme/openapi-parser"
import { Buffer } from "buffer"
import YAML from "yaml"
import type {
  OpenAPISpec,
  Parameter,
  ParsedRoute,
  SchemaObject,
  ServerObject,
} from "./types"

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer }
globalScope.Buffer ??= Buffer

const PARSER_OPTIONS = {
  dereference: {
    circular: "ignore",
  },
  resolve: {
    external: true,
    file: false,
  },
} satisfies ParserOptions

type ParserInput = Parameters<typeof parseOpenAPIDocument>[0]

function asParserInput(input: string | OpenAPISpec): ParserInput {
  return input as ParserInput
}

function cloneSpec<T>(spec: T): T {
  return structuredClone(spec)
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatValidationError(result: ValidationResult): string {
  if (result.valid) return ""
  return compileErrors(result).trim()
    || result.errors[0]?.message
    || "Invalid OpenAPI document"
}

export function parseSpecText(text: string): OpenAPISpec {
  const trimmed = text.trim()
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as OpenAPISpec
  }
  return YAML.parse(trimmed) as OpenAPISpec
}

export async function parseValidatedSpec(input: string | OpenAPISpec): Promise<{
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec
}> {
  const parserInput = asParserInput(input)
  const sourceSpec = await parseOpenAPIDocument(parserInput, PARSER_OPTIONS) as OpenAPISpec
  const validationInput = typeof input === "string" ? parserInput : asParserInput(cloneSpec(sourceSpec))
  const validation = await validate(validationInput, PARSER_OPTIONS)
  if (!validation.valid) {
    throw new Error(formatValidationError(validation))
  }

  const dereferenceInput = typeof input === "string" ? parserInput : asParserInput(cloneSpec(sourceSpec))
  const spec = await dereference(dereferenceInput, PARSER_OPTIONS)

  return {
    spec: spec as OpenAPISpec,
    sourceSpec: sourceSpec as OpenAPISpec,
  }
}

export function resolveServerUrl(srv: ServerObject): string {
  let url = srv.url
  if (srv.variables) {
    for (const [k, v] of Object.entries(srv.variables)) {
      url = url.replace(`{${k}}`, v.default || "")
    }
  }
  return url
}

function rewriteRefs(obj: unknown): void {
  if (!obj || typeof obj !== "object") return
  if (Array.isArray(obj)) {
    obj.forEach(rewriteRefs)
    return
  }
  const r = obj as Record<string, unknown>
  if (typeof r.$ref === "string" && r.$ref.startsWith("#/definitions/")) {
    r.$ref = r.$ref.replace("#/definitions/", "#/components/schemas/")
  }
  for (const v of Object.values(r)) rewriteRefs(v)
}

function schemaFromSwaggerParameter(param: Parameter): SchemaObject {
  if (param.type === "file") {
    return {
      type: "string",
      format: "binary",
      description: param.description || "",
    }
  }

  const schema: SchemaObject = { type: param.type || "string" }
  if (param.format) schema.format = param.format
  if (param.enum) schema.enum = param.enum
  if (param.default !== undefined) schema.default = param.default
  if (param.description) schema.description = param.description
  return schema
}

export function convertSwaggerV2(spec: OpenAPISpec): OpenAPISpec {
  const s = cloneSpec(spec)
  const scheme = s.schemes?.[0] || "https"
  const host = s.host || ""
  const basePath = (s.basePath || "").replace(/\/$/, "")
  if (host) s.servers = [{ url: `${scheme}://${host}${basePath}` }]

  if (s.definitions && !s.components) {
    s.components = { schemas: s.definitions }
    rewriteRefs(s.paths)
    rewriteRefs(s.components)
  }
  if (s.securityDefinitions) {
    if (!s.components) s.components = {}
    // Convert Swagger 2.0 top-level oauth2 fields to OAS3 flows structure
    for (const scheme of Object.values(s.securityDefinitions)) {
      if (scheme.type === "oauth2" && scheme.flow && !scheme.flows) {
        const flowObj = {
          tokenUrl: scheme.tokenUrl,
          authorizationUrl: scheme.authorizationUrl,
          scopes: scheme.scopes ?? {},
        }
        const flowMap: Record<string, string> = {
          password: "password",
          application: "clientCredentials",
          accessCode: "authorizationCode",
          implicit: "implicit",
        }
        const oas3Flow = flowMap[scheme.flow]
        if (oas3Flow) {
          scheme.flows = { [oas3Flow]: flowObj }
        }
      }
    }
    s.components.securitySchemes = s.securityDefinitions
  }

  const globalConsumes = s.consumes || ["application/json"]
  for (const pathItem of Object.values(s.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue
      const params = op.parameters || []
      const bodyParam = params.find(p => p.in === "body")
      const formParams = params.filter(p => p.in === "formData")
      const consumes = op.consumes || globalConsumes
      op.parameters = params.filter(p => p.in !== "body" && p.in !== "formData")

      if (bodyParam && !op.requestBody) {
        op.requestBody = {
          required: !!bodyParam.required,
          content: {
            [consumes[0] || "application/json"]: {
              schema: bodyParam.schema || {},
            },
          },
        }
      } else if (formParams.length && !op.requestBody) {
        const isFile = formParams.some(p => p.type === "file")
        const ct = isFile
          ? "multipart/form-data"
          : consumes.includes("multipart/form-data")
            ? "multipart/form-data"
            : "application/x-www-form-urlencoded"
        const props: Record<string, SchemaObject> = {}
        const req: string[] = []
        for (const fp of formParams) {
          props[fp.name] = schemaFromSwaggerParameter(fp)
          if (fp.required) req.push(fp.name)
        }
        const schema: SchemaObject = { type: "object", properties: props }
        if (req.length) schema.required = req
        op.requestBody = { content: { [ct]: { schema } } }
      }

      const produces = op.produces || s.produces || ["application/json"]
      for (const resp of Object.values(op.responses || {})) {
        if (resp.schema && !resp.content) {
          resp.content = { [produces[0] || "application/json"]: { schema: resp.schema } }
          delete resp.schema
        }
      }
    }
  }
  return s
}

export function normalizeParsedSpec(spec: OpenAPISpec): OpenAPISpec {
  return spec.swagger === "2.0" ? convertSwaggerV2(spec) : spec
}

export function getOperationKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`
}

export function collectModelRefs(obj: unknown, found: Set<string>): void {
  if (!obj || typeof obj !== "object") return
  const record = obj as Record<string, unknown>
  if (typeof record.$ref === "string") {
    const match = record.$ref.match(/^#\/(components\/schemas|definitions)\/(.+)$/)
    const modelName = match?.[2]
    if (modelName) found.add(modelName)
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectModelRefs(item, found)
  } else {
    for (const v of Object.values(record)) collectModelRefs(v, found)
  }
}

export function buildModelRouteMap(routes: ParsedRoute[]) {
  const modelToRoutes: Record<string, number[]> = {}
  const routeToModels: Record<number, string[]> = {}
  for (const [i, route] of routes.entries()) {
    const models = route.referencedModels
    routeToModels[i] = models
    for (const m of models) {
      if (!modelToRoutes[m]) modelToRoutes[m] = []
      modelToRoutes[m].push(i)
    }
  }
  return { modelToRoutes, routeToModels }
}
