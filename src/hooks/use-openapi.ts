import { useCallback } from "react"
import i18n from "@/lib/i18n"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import type {
  ModelRouteMap,
  OAuth2Endpoints,
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
import { detectSpecType, parseAsyncAPIDocument } from "@/lib/asyncapi/parser"

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
  const endpoints = detectOAuth2Endpoints(spec)
  return endpoints?.tokenUrl ?? null
}

function detectOAuth2Endpoints(spec: OpenAPISpec): OAuth2Endpoints | null {
  const schemes = spec.components?.securitySchemes || {}
  for (const [name, scheme] of Object.entries(schemes)) {
    if (scheme.type !== "oauth2") continue

    // OAS 3.x flows (prefer password → clientCredentials → authorizationCode)
    if (scheme.flows) {
      for (const flowName of ["password", "clientCredentials", "authorizationCode", "implicit"] as const) {
        const flow = scheme.flows[flowName]
        if (!flow) continue
        return {
          schemeName: name,
          flow: flowName,
          tokenUrl: flow.tokenUrl ?? null,
          refreshUrl: flow.refreshUrl ?? null,
          authorizationUrl: flow.authorizationUrl ?? null,
          scopes: flow.scopes ?? {},
        }
      }
    }

    // Swagger 2.0 top-level fields (fallback if not converted)
    if (scheme.flow && scheme.tokenUrl) {
      return {
        schemeName: name,
        flow: scheme.flow,
        tokenUrl: scheme.tokenUrl,
        refreshUrl: null,
        authorizationUrl: scheme.authorizationUrl ?? null,
        scopes: scheme.scopes ?? {},
      }
    }
  }
  return null
}

export function useOpenAPI() {
  const { state, dispatch } = useOpenAPIContext()
  const { dispatch: asyncDispatch } = useAsyncAPIContext()

  const yieldToUI = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)))

  const processOpenAPISpec = useCallback(async (input: string | OpenAPISpec, url: string, baseUrlOverride?: string) => {
    const { spec: parsedSpec, sourceSpec } = await parseValidatedSpec(input)
    const spec = normalizeParsedSpec(parsedSpec)
    asyncDispatch({ type: "RESET" })
    dispatch({ type: "SET_SPEC", spec, sourceSpec })
    dispatch({ type: "SET_SPEC_URL", url })
    await yieldToUI()
    const { routes, allTags, modelRouteMap } = extractRoutes(spec, sourceSpec)
    const baseUrl = baseUrlOverride?.trim() || detectBaseUrl(spec, url)
    dispatch({ type: "SET_ROUTES", routes, allTags, modelRouteMap })
    dispatch({ type: "SET_BASE_URL", url: baseUrl })
    dispatch({ type: "SET_LOADING", loading: false })
  }, [dispatch, asyncDispatch])

  const processAsyncAPISpec = useCallback(async (rawText: string, url: string) => {
    const result = await parseAsyncAPIDocument(rawText)
    // Populate OpenAPIContext with a compatibility shim so getSchemas()/getSpecInfo()
    // and all downstream consumers (ModelsView, SchemaViewerView, sidebar) work without branching.
    const compatSpec: OpenAPISpec = {
      openapi: `AsyncAPI ${result.info.specVersion}`,
      info: {
        title: result.info.title,
        version: result.info.version,
        description: result.info.description,
      },
      components: { schemas: result.schemas },
    }
    if (result.info.license) (compatSpec.info as Record<string, unknown>).license = result.info.license
    if (result.info.contact) (compatSpec.info as Record<string, unknown>).contact = result.info.contact
    if (result.info.termsOfService) (compatSpec.info as Record<string, unknown>).termsOfService = result.info.termsOfService
    if (result.info.externalDocs) (compatSpec as Record<string, unknown>).externalDocs = result.info.externalDocs

    dispatch({ type: "SET_SPEC", spec: compatSpec })
    dispatch({ type: "SET_SPEC_TYPE", specType: "asyncapi" })
    dispatch({ type: "SET_SPEC_URL", url })
    dispatch({ type: "SET_ROUTES", routes: [], allTags: [], modelRouteMap: { modelToRoutes: {}, routeToModels: {} } })
    asyncDispatch({ type: "SET_PARSED_RESULT", result })
    dispatch({ type: "SET_MAIN_VIEW", view: "channels" })
    dispatch({ type: "SET_LOADING", loading: false })
  }, [dispatch, asyncDispatch])

  const loadFromUrl = useCallback(async (url: string, options?: { baseUrlOverride?: string; fetchAuth?: { username: string; password: string } }) => {
    if (!url.trim()) return
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })
    try {
      // Fetch the raw text to detect spec type.
      let response: Response
      const fetchInit: RequestInit = {}
      if (options?.fetchAuth) {
        const { username, password } = options.fetchAuth
        fetchInit.headers = { Authorization: `Basic ${btoa(`${username}:${password}`)}` }
      }
      try {
        response = await fetch(url, fetchInit)
      } catch (fetchErr) {
        // Distinguish common network-level failures
        const msg = fetchErr instanceof TypeError ? fetchErr.message : ""
        if (msg.includes("Failed to fetch")) {
          const isHttps = url.startsWith("https://")
          let isCrossOrigin = false
          try { isCrossOrigin = new URL(url).origin !== location.origin } catch { /* invalid URL */ }
          if (isCrossOrigin) {
            throw new Error(i18n.t("error.fetchCors", { url: new URL(url).origin }), { cause: fetchErr })
          }
          throw new Error(isHttps
            ? i18n.t("error.fetchNetwork", { url })
            : i18n.t("error.fetchNetworkHttp", { url }), { cause: fetchErr })
        }
        throw fetchErr
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(i18n.t("error.fetchAuth", { status: response.status }))
        }
        throw new Error(i18n.t("error.fetchHttp", { status: response.status, statusText: response.statusText }))
      }
      const text = await response.text()
      const specType = detectSpecType(text)
      if (specType === "asyncapi") {
        await processAsyncAPISpec(text, url)
      } else {
        // Pass raw text to OpenAPI parser (not the URL) so it doesn't double-fetch.
        // parseValidatedSpec/asParserInput handles raw JSON/YAML strings fine.
        await processOpenAPISpec(parseSpecText(text), url, options?.baseUrlOverride)
      }
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: getErrorMessage(e) })
      dispatch({ type: "SET_LOADING", loading: false })
    }
  }, [dispatch, processOpenAPISpec, processAsyncAPISpec])

  const loadFromFile = useCallback((file: File) => {
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const result = e.target?.result
        if (typeof result !== "string") throw new Error(i18n.t("validation.fileReadFailed"))
        const specType = detectSpecType(result)
        if (specType === "asyncapi") {
          await processAsyncAPISpec(result, "")
        } else {
          await processOpenAPISpec(parseSpecText(result), "")
        }
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
  }, [dispatch, processOpenAPISpec, processAsyncAPISpec])

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

  const getOAuth2Endpoints = useCallback((): OAuth2Endpoints | null => {
    if (!state.spec) return null
    return detectOAuth2Endpoints(state.spec)
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
    getOAuth2Endpoints,
    getSchemas,
    getSpecInfo,
    getModelRouteMap,
  }
}
