import { useCallback } from "react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import type {
  OpenAPISpec,
  ParsedRoute,
  TagInfo,
  Parameter,
  ServerObject,
} from "@/lib/openapi/types"

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const

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
  if (Array.isArray(obj)) {
    obj.forEach(rewriteRefs)
    return
  }
  const record = obj as Record<string, unknown>
  if (typeof record.$ref === "string" && record.$ref.startsWith("#/definitions/")) {
    record.$ref = record.$ref.replace("#/definitions/", "#/components/schemas/")
  }
  for (const v of Object.values(record)) rewriteRefs(v)
}

function convertV2toV3(s: OpenAPISpec): OpenAPISpec {
  const scheme = s.schemes?.[0] || "https"
  const host = s.host || ""
  const basePath = (s.basePath || "").replace(/\/$/, "")
  if (host) {
    s.servers = [{ url: `${scheme}://${host}${basePath}`, description: "Converted from Swagger 2.0" }]
  }

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
      const params = (op.parameters || []) as Parameter[]
      const bodyParam = params.find(p => p.in === "body")
      const formParams = params.filter(p => p.in === "formData")
      const consumes = op.consumes || globalConsumes

      op.parameters = params.filter(p => p.in !== "body" && p.in !== "formData")

      if (bodyParam && !op.requestBody) {
        const ct = consumes[0] || "application/json"
        op.requestBody = {
          required: !!bodyParam.required,
          content: { [ct]: { schema: bodyParam.schema || {} } },
        }
      } else if (formParams.length && !op.requestBody) {
        const isFileUpload = formParams.some(p => p.type === "file")
        const ct = isFileUpload
          ? "multipart/form-data"
          : consumes.includes("multipart/form-data")
            ? "multipart/form-data"
            : "application/x-www-form-urlencoded"
        const props: Record<string, Record<string, unknown>> = {}
        const required: string[] = []
        for (const fp of formParams) {
          if (fp.type === "file") {
            props[fp.name] = { type: "string", format: "binary", description: fp.description || "" }
          } else {
            props[fp.name] = {
              type: fp.type || "string",
              format: fp.format,
              enum: fp.enum,
              default: fp.default,
              description: fp.description || "",
            }
          }
          if (fp.required) required.push(fp.name)
        }
        op.requestBody = {
          content: {
            [ct]: {
              schema: {
                type: "object",
                properties: props,
                required: required.length ? required : undefined,
              },
            },
          },
        }
      }

      const produces = op.produces || s.produces || ["application/json"]
      for (const resp of Object.values(op.responses || {})) {
        if (resp.schema && !resp.content) {
          const mt = produces[0] || "application/json"
          resp.content = { [mt]: { schema: resp.schema } }
          delete resp.schema
        }
      }
    }
  }
  return s
}

function resolveRef(obj: unknown, root: OpenAPISpec, seen: Set<string>): unknown {
  if (!obj || typeof obj !== "object") return obj
  const record = obj as Record<string, unknown>

  if (typeof record.$ref === "string") {
    const refPath = record.$ref.replace(/^#\//, "").split("/")
    let resolved: unknown = root
    for (const p of refPath) {
      resolved = (resolved as Record<string, unknown>)?.[decodeURIComponent(p)]
    }
    if (!resolved) return { _unresolved: record.$ref }
    if (seen.has(record.$ref)) return { _circular: record.$ref }
    seen.add(record.$ref)
    const resolvedObj = resolveRef(resolved, root, seen)
    const siblings = Object.keys(record).filter(k => k !== "$ref")
    if (siblings.length && typeof resolvedObj === "object" && resolvedObj && !Array.isArray(resolvedObj)) {
      const merged = { ...(resolvedObj as Record<string, unknown>) }
      for (const k of siblings) merged[k] = record[k]
      return merged
    }
    return resolvedObj
  }

  if (Array.isArray(obj)) return obj.map(item => resolveRef(item, root, new Set(seen)))

  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    result[k] = resolveRef(v, root, new Set(seen))
  }
  return result
}

function parseRoutes(spec: OpenAPISpec): { routes: ParsedRoute[]; allTags: TagInfo[] } {
  const routes: ParsedRoute[] = []
  const tagSet = new Set<string>()
  const tagCounts: Record<string, number> = {}

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue
      const tags = op.tags || ["未分组"]
      tags.forEach(t => {
        tagSet.add(t)
        tagCounts[t] = (tagCounts[t] || 0) + 1
      })
      const resolved = resolveRef(op, spec, new Set()) as Record<string, unknown>
      const pathParams = resolveRef(pathItem.parameters || [], spec, new Set()) as Parameter[]
      routes.push({
        method,
        path,
        tags,
        summary: (resolved.summary as string) || "",
        description: (resolved.description as string) || "",
        operationId: (resolved.operationId as string) || "",
        parameters: [...pathParams, ...((resolved.parameters as Parameter[]) || [])],
        requestBody: (resolved.requestBody as ParsedRoute["requestBody"]) || null,
        responses: (resolved.responses as ParsedRoute["responses"]) || {},
        security: (resolved.security as ParsedRoute["security"]) || spec.security || [],
        selected: false,
      })
    }
  }

  const allTags: TagInfo[] = [...tagSet].map(name => ({ name, count: tagCounts[name] || 0 }))
  return { routes, allTags }
}

function detectBaseUrl(spec: OpenAPISpec, specUrl: string): string {
  const servers = spec.servers || []
  if (servers.length) {
    return resolveServerUrl(servers[0])
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

  const loadFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let spec: OpenAPISpec = await res.json()
      if (spec.swagger === "2.0") spec = convertV2toV3(spec)
      const { routes, allTags } = parseRoutes(spec)
      const baseUrl = detectBaseUrl(spec, url)
      dispatch({ type: "SET_SPEC", spec })
      dispatch({ type: "SET_ROUTES", routes, allTags })
      dispatch({ type: "SET_BASE_URL", url: baseUrl })
      dispatch({ type: "SET_SPEC_URL", url })
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: (e as Error).message })
    } finally {
      dispatch({ type: "SET_LOADING", loading: false })
    }
  }, [dispatch])

  const loadFromFile = useCallback((file: File) => {
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let spec: OpenAPISpec = JSON.parse(e.target?.result as string)
        if (spec.swagger === "2.0") spec = convertV2toV3(spec)
        const { routes, allTags } = parseRoutes(spec)
        const baseUrl = detectBaseUrl(spec, "")
        dispatch({ type: "SET_SPEC", spec })
        dispatch({ type: "SET_ROUTES", routes, allTags })
        dispatch({ type: "SET_BASE_URL", url: baseUrl })
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: (err as Error).message })
      } finally {
        dispatch({ type: "SET_LOADING", loading: false })
      }
    }
    reader.onerror = () => {
      dispatch({ type: "SET_ERROR", error: "文件读取失败" })
      dispatch({ type: "SET_LOADING", loading: false })
    }
    reader.readAsText(file)
  }, [dispatch])

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
      version: info.version || "",
      description: info.description || "",
      specVersion: state.spec.openapi || state.spec.swagger || "?",
      routeCount: state.routes.length,
    }
  }, [state.spec, state.routes.length])

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
  }
}
