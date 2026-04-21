import { useEffect, useRef } from "react"
import { useOpenAPIContext, type UrlState } from "@/contexts/OpenAPIContext"
import type { EndpointDetailTab, MainView, ModelViewMode, SchemaViewerSource } from "@/lib/openapi/types"

const MAIN_VIEWS = new Set<MainView>(["endpoints", "favorites", "models", "schemas", "diagnostics", "diff"])
const ENDPOINT_DETAIL_TABS = new Set<EndpointDetailTab>(["doc", "try"])
const MODEL_VIEW_MODES = new Set<ModelViewMode>(["list", "graph"])
const SCHEMA_SOURCES = new Set<SchemaViewerSource>(["openapi", "external"])

function getFirstParam(params: URLSearchParams, name: string): string {
  return params.get(name)?.trim() || ""
}

function getViewFromHashPath(path: string, params: URLSearchParams): MainView {
  const value = path.replace(/^\/+/, "")
  if (value === "tools") {
    return getFirstParam(params, "tab") === "diff" ? "diff" : "diagnostics"
  }
  return MAIN_VIEWS.has(value as MainView) ? value as MainView : "endpoints"
}

function getEndpointDetailTab(value: string): EndpointDetailTab {
  return ENDPOINT_DETAIL_TABS.has(value as EndpointDetailTab) ? value as EndpointDetailTab : "doc"
}

function getModelViewMode(value: string): ModelViewMode {
  return MODEL_VIEW_MODES.has(value as ModelViewMode) ? value as ModelViewMode : "list"
}

function getSchemaSource(value: string): SchemaViewerSource {
  return SCHEMA_SOURCES.has(value as SchemaViewerSource) ? value as SchemaViewerSource : "openapi"
}

export function parseHashState(hash: string): UrlState {
  const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash
  const queryStart = cleanHash.indexOf("?")
  const path = queryStart === -1 ? cleanHash : cleanHash.slice(0, queryStart)
  const query = queryStart === -1 ? "" : cleanHash.slice(queryStart + 1)
  const params = new URLSearchParams(query)
  const mainView = getViewFromHashPath(path, params)
  const q = getFirstParam(params, "q")

  return {
    mainView,
    filter: mainView === "endpoints" ? q : "",
    activeTags: mainView === "endpoints"
      ? new Set(params.getAll("tag").filter(tag => tag.trim().length > 0))
      : new Set(),
    activeEndpointKey: mainView === "endpoints" ? getFirstParam(params, "endpoint") : "",
    endpointDetailTab: mainView === "endpoints" ? getEndpointDetailTab(getFirstParam(params, "tab")) : "doc",
    modelFilter: mainView === "models" ? q : "",
    modelViewMode: mainView === "models" ? getModelViewMode(getFirstParam(params, "mode")) : "list",
    activeModelName: mainView === "models" ? getFirstParam(params, "model") : "",
    schemaFilter: mainView === "schemas" ? q : "",
    schemaCategoryFilter: mainView === "schemas" ? getFirstParam(params, "category") : "",
    schemaTypeFilter: mainView === "schemas" ? getFirstParam(params, "type") : "",
    activeSchemaName: mainView === "schemas" ? getFirstParam(params, "schema") : "",
    schemaSource: mainView === "schemas" ? getSchemaSource(getFirstParam(params, "source")) : "openapi",
  }
}

export function buildHashState(state: UrlState): string {
  const params = new URLSearchParams()

  if (state.mainView === "endpoints") {
    if (state.filter) params.set("q", state.filter)
    for (const tag of [...state.activeTags].sort()) params.append("tag", tag)
    if (state.activeEndpointKey) params.set("endpoint", state.activeEndpointKey)
    if (state.endpointDetailTab !== "doc") params.set("tab", state.endpointDetailTab)
  }

  if (state.mainView === "models") {
    if (state.modelFilter) params.set("q", state.modelFilter)
    if (state.modelViewMode !== "list") params.set("mode", state.modelViewMode)
    if (state.activeModelName) params.set("model", state.activeModelName)
  }

  if (state.mainView === "schemas") {
    if (state.schemaFilter) params.set("q", state.schemaFilter)
    if (state.schemaCategoryFilter) params.set("category", state.schemaCategoryFilter)
    if (state.schemaTypeFilter) params.set("type", state.schemaTypeFilter)
    if (state.activeSchemaName) params.set("schema", state.activeSchemaName)
    if (state.schemaSource !== "openapi") params.set("source", state.schemaSource)
  }

  const query = params.toString()
  return `#/${state.mainView}${query ? `?${query}` : ""}`
}

export function useUrlState() {
  const { state, dispatch } = useOpenAPIContext()
  const lastHashRef = useRef("")
  const writeInitializedRef = useRef(false)
  const {
    activeTags,
    activeEndpointKey,
    activeModelName,
    endpointDetailTab,
    filter,
    mainView,
    activeSchemaName,
    modelFilter,
    modelViewMode,
    schemaCategoryFilter,
    schemaFilter,
    schemaSource,
    schemaTypeFilter,
  } = state

  useEffect(() => {
    const applyHashState = () => {
      const hash = window.location.hash || "#/endpoints"
      lastHashRef.current = hash
      dispatch({ type: "APPLY_URL_STATE", urlState: parseHashState(hash) })
    }

    applyHashState()
    window.addEventListener("hashchange", applyHashState)
    return () => window.removeEventListener("hashchange", applyHashState)
  }, [dispatch])

  useEffect(() => {
    if (!writeInitializedRef.current) {
      writeInitializedRef.current = true
      return
    }

    const nextHash = buildHashState({
      mainView,
      filter,
      activeTags,
      activeEndpointKey,
      endpointDetailTab,
      modelFilter,
      modelViewMode,
      activeModelName,
      schemaFilter,
      schemaCategoryFilter,
      schemaTypeFilter,
      activeSchemaName,
      schemaSource,
    })
    if (lastHashRef.current === nextHash) return
    lastHashRef.current = nextHash
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`)
  }, [
    activeTags,
    activeEndpointKey,
    activeModelName,
    endpointDetailTab,
    filter,
    mainView,
    activeSchemaName,
    modelFilter,
    modelViewMode,
    schemaCategoryFilter,
    schemaFilter,
    schemaSource,
    schemaTypeFilter,
  ])
}
