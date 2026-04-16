import { useCallback } from "react"
import i18n from "@/lib/i18n"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import type {
  ModelRouteMap,
  OpenAPISpec,
  ParsedRoute,
  TagInfo,
} from "@/lib/openapi/types"
import {
  HTTP_METHODS,
  buildModelRouteMap,
  collectModelRefs,
  getErrorMessage,
  normalizeParsedSpec,
  parseSpecText,
  parseValidatedSpec,
  resolveServerUrl,
} from "@/lib/openapi/parser"

function extractRoutes(spec: OpenAPISpec, sourceSpec: OpenAPISpec): {
  routes: ParsedRoute[]
  allTags: TagInfo[]
  modelRouteMap: ModelRouteMap
} {
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

  const yieldToUI = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)))

  const processSpec = useCallback(async (input: string | OpenAPISpec, url: string) => {
    const { spec: parsedSpec, sourceSpec } = await parseValidatedSpec(input)
    const spec = normalizeParsedSpec(parsedSpec)
    dispatch({ type: "SET_SPEC", spec, sourceSpec })
    dispatch({ type: "SET_SPEC_URL", url })
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
        await processSpec(parseSpecText(result), "")
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
