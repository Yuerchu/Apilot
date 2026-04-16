import { useCallback } from "react"
import {
  compileErrors,
  dereference,
  parse as parseOpenAPIDocument,
  validate,
} from "@readme/openapi-parser"
import type { ParserOptions, ValidationResult } from "@readme/openapi-parser"
import { Buffer } from "buffer"
import YAML from "yaml"
import i18n from "@/lib/i18n"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import type {
  OpenAPISpec,
  ParsedRoute,
  TagInfo,
  Parameter,
  SchemaObject,
  ServerObject,
  ModelRouteMap,
} from "@/lib/openapi/types"

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatValidationError(result: ValidationResult): string {
  if (result.valid) return ""
  return compileErrors(result).trim()
    || result.errors[0]?.message
    || "Invalid OpenAPI document"
}

async function parseValidatedSpec(input: string | OpenAPISpec): Promise<{
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

function resolveServerUrl(srv: ServerObject): string {
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
  if (Array.isArray(obj)) { obj.forEach(rewriteRefs); return }
  const r = obj as Record<string, unknown>
  if (typeof r.$ref === "string" && r.$ref.startsWith("#/definitions/"))
    r.$ref = r.$ref.replace("#/definitions/", "#/components/schemas/")
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

function convertSwaggerV2(s: OpenAPISpec): OpenAPISpec {
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
        op.requestBody = { required: !!bodyParam.required, content: { [consumes[0] || "application/json"]: { schema: bodyParam.schema || {} } } }
      } else if (formParams.length && !op.requestBody) {
        const isFile = formParams.some(p => p.type === "file")
        const ct = isFile ? "multipart/form-data" : consumes.includes("multipart/form-data") ? "multipart/form-data" : "application/x-www-form-urlencoded"
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

/** Collect all schema model names referenced via $ref in an operation */
function collectModelRefs(obj: unknown, found: Set<string>): void {
  if (!obj || typeof obj !== "object") return
  const record = obj as Record<string, unknown>
  if (typeof record.$ref === "string") {
    // Extract model name from #/components/schemas/Foo or #/definitions/Foo
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

function buildModelRouteMap(routes: ParsedRoute[]): ModelRouteMap {
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

function extractRoutes(spec: OpenAPISpec, sourceSpec: OpenAPISpec): { routes: ParsedRoute[]; allTags: TagInfo[]; modelRouteMap: ModelRouteMap } {
  const routes: ParsedRoute[] = []
  const tagSet = new Set<string>()
  const tagCounts: Record<string, number> = {}

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    const sourcePathItem = sourceSpec.paths?.[path]
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue
      const tags = op.tags || [i18n.t("endpoints.ungrouped")]
      tags.forEach(t => {
        tagSet.add(t)
        tagCounts[t] = (tagCounts[t] || 0) + 1
      })
      // Collect model $refs before resolving
      const refs = new Set<string>()
      collectModelRefs(sourcePathItem?.[method] || op, refs)

      routes.push({
        method,
        path,
        tags,
        summary: op.summary || "",
        description: op.description || "",
        operationId: op.operationId || "",
        parameters: [...(pathItem.parameters || []), ...(op.parameters || [])],
        requestBody: op.requestBody || null,
        responses: op.responses || {},
        security: op.security || spec.security || [],
        selected: false,
        referencedModels: [...refs],
      })
    }
  }

  const allTags: TagInfo[] = [...tagSet].map(name => ({ name, count: tagCounts[name] || 0 }))
  const modelRouteMap = buildModelRouteMap(routes)
  return { routes, allTags, modelRouteMap }
}

function detectBaseUrl(spec: OpenAPISpec, specUrl: string): string {
  const servers = spec.servers || []
  const firstServer = servers[0]
  if (firstServer) {
    return resolveServerUrl(firstServer)
  }
  try {
    const u = new URL(specUrl)
    return u.origin
  } catch {
    return ""
  }
}

function detectOAuth2TokenUrl(spec: OpenAPISpec): string | null {
  const schemes = spec.components?.securitySchemes || {}
  for (const scheme of Object.values(schemes)) {
    if (scheme.type === "oauth2" && scheme.flows?.password) {
      return scheme.flows.password.tokenUrl || null
    }
  }
  return null
}

export function useOpenAPI() {
  const { state, dispatch } = useOpenAPIContext()

  // Yield to UI between heavy parsing steps
  const yieldToUI = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)))

  const processSpec = useCallback(async (input: string | OpenAPISpec, url: string) => {
    const { spec: parsedSpec, sourceSpec } = await parseValidatedSpec(input)
    let spec = parsedSpec
    if (spec.swagger === "2.0") spec = convertSwaggerV2(spec)
    dispatch({ type: "SET_SPEC", spec, sourceSpec })
    dispatch({ type: "SET_SPEC_URL", url })
    // Let loading skeleton render before heavy parsing
    await yieldToUI()
    const { routes, allTags, modelRouteMap } = extractRoutes(spec, sourceSpec)
    const baseUrl = detectBaseUrl(spec, url)
    dispatch({ type: "SET_ROUTES", routes, allTags, modelRouteMap })
    dispatch({ type: "SET_BASE_URL", url: baseUrl })
    dispatch({ type: "SET_LOADING", loading: false })
  }, [dispatch])

  const loadFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })
    try {
      await processSpec(url, url)
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: getErrorMessage(e) })
      dispatch({ type: "SET_LOADING", loading: false })
    }
  }, [dispatch, processSpec])

  const loadFromFile = useCallback((file: File) => {
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const result = e.target?.result
        if (typeof result !== "string") throw new Error(i18n.t("validation.fileReadFailed"))
        // Support both JSON and YAML
        let spec: OpenAPISpec
        const trimmed = result.trim()
        if (trimmed.startsWith("{")) {
          spec = JSON.parse(trimmed) as OpenAPISpec
        } else {
          spec = YAML.parse(trimmed) as OpenAPISpec
        }
        await processSpec(spec, "")
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: getErrorMessage(err) })
        dispatch({ type: "SET_LOADING", loading: false })
      }
    }
    reader.onerror = () => {
      dispatch({ type: "SET_ERROR", error: i18n.t("validation.fileReadFailed") })
      dispatch({ type: "SET_LOADING", loading: false })
    }
    reader.readAsText(file)
  }, [dispatch, processSpec])

  const getServers = useCallback(() => {
    const servers = state.spec?.servers || []
    return servers.map(s => ({
      url: resolveServerUrl(s),
      description: s.description,
    }))
  }, [state.spec])

  const getOAuth2TokenUrl = useCallback(() => {
    if (!state.spec) return null
    return detectOAuth2TokenUrl(state.spec)
  }, [state.spec])

  const getSchemas = useCallback(() => {
    if (!state.spec) return {}
    return state.spec.components?.schemas || state.spec.definitions || {}
  }, [state.spec])

  const getSpecInfo = useCallback(() => {
    if (!state.spec) return null
    const info = state.spec.info || {}
    return {
      title: info.title || "API",
      summary: info.summary || "",
      version: info.version || "",
      description: info.description || "",
      specVersion: state.spec.openapi || state.spec.swagger || "?",
      routeCount: state.routes.length,
      license: (info.license || null) as { name?: string; url?: string; identifier?: string } | null,
      contact: (info.contact || null) as { name?: string; url?: string; email?: string } | null,
      termsOfService: info.termsOfService || null,
      externalDocs: state.spec.externalDocs || null,
    }
  }, [state.spec, state.routes.length])

  const getModelRouteMap = useCallback(() => {
    return state.modelRouteMap
  }, [state.modelRouteMap])

  return {
    spec: state.spec,
    routes: state.routes,
    loading: state.loading,
    error: state.error,
    loadFromUrl,
    loadFromFile,
    getServers,
    getOAuth2TokenUrl,
    getSchemas,
    getSpecInfo,
    getModelRouteMap,
  }
}
