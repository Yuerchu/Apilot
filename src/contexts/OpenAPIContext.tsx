import { createContext, useContext, useReducer, useCallback } from "react"
import type { ReactNode } from "react"
import type {
  OpenAPISpec,
  ParsedRoute,
  EndpointDetailTab,
  MainView,
  ModelViewMode,
  SchemaViewerSource,
  SpecType,
  TagInfo,
  ModelRouteMap,
} from "@/lib/openapi/types"
import { getParsedRouteKey } from "@/lib/openapi/route-key"

interface OpenAPIState {
  spec: OpenAPISpec | null
  sourceSpec: OpenAPISpec | null
  routes: ParsedRoute[]
  modelRouteMap: ModelRouteMap
  selectedRoutes: Set<number>
  selectedModels: Set<string>
  activeTags: Set<string>
  allTags: TagInfo[]
  filter: string
  activeEndpointKey: string
  endpointDetailTab: EndpointDetailTab
  modelFilter: string
  modelViewMode: ModelViewMode
  activeModelName: string
  schemaFilter: string
  schemaCategoryFilter: string
  schemaTypeFilter: string
  activeSchemaName: string
  schemaSource: SchemaViewerSource
  mainView: MainView
  baseUrl: string
  specUrl: string
  specType: SpecType
  loading: boolean
  error: string | null
}

type Action =
  | { type: "SET_SPEC"; spec: OpenAPISpec; sourceSpec?: OpenAPISpec }
  | { type: "SET_ROUTES"; routes: ParsedRoute[]; allTags: TagInfo[]; modelRouteMap: ModelRouteMap }
  | { type: "TOGGLE_ROUTE"; index: number }
  | { type: "SELECT_ROUTES"; indices: number[] }
  | { type: "DESELECT_ROUTES"; indices: number[] }
  | { type: "SELECT_ALL_ROUTES" }
  | { type: "CLEAR_ROUTE_SELECTION" }
  | { type: "TOGGLE_MODEL"; name: string }
  | { type: "SELECT_ALL_MODELS"; names: string[] }
  | { type: "CLEAR_MODEL_SELECTION" }
  | { type: "TOGGLE_TAG"; tag: string }
  | { type: "SET_ACTIVE_TAGS"; tags: Set<string> }
  | { type: "CLEAR_TAGS" }
  | { type: "INVERT_TAGS"; visibleTags: string[] }
  | { type: "SET_FILTER"; filter: string }
  | { type: "SET_ACTIVE_ENDPOINT_KEY"; key: string }
  | { type: "SET_ENDPOINT_DETAIL_TAB"; tab: EndpointDetailTab }
  | { type: "SET_MODEL_FILTER"; filter: string }
  | { type: "SET_MODEL_VIEW_MODE"; mode: ModelViewMode }
  | { type: "SET_ACTIVE_MODEL_NAME"; name: string }
  | { type: "SET_SCHEMA_FILTER"; filter: string }
  | { type: "SET_SCHEMA_CATEGORY_FILTER"; filter: string }
  | { type: "SET_SCHEMA_TYPE_FILTER"; filter: string }
  | { type: "SET_ACTIVE_SCHEMA_NAME"; name: string }
  | { type: "SET_SCHEMA_SOURCE"; source: SchemaViewerSource }
  | { type: "SET_MAIN_VIEW"; view: MainView }
  | { type: "SET_BASE_URL"; url: string }
  | { type: "SET_SPEC_URL"; url: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_SPEC_TYPE"; specType: SpecType }
  | { type: "APPLY_URL_STATE"; urlState: UrlState }
  | { type: "RESET" }

export interface UrlState {
  mainView: MainView
  filter: string
  activeTags: Set<string>
  activeEndpointKey: string
  endpointDetailTab: EndpointDetailTab
  modelFilter: string
  modelViewMode: ModelViewMode
  activeModelName: string
  schemaFilter: string
  schemaCategoryFilter: string
  schemaTypeFilter: string
  activeSchemaName: string
  schemaSource: SchemaViewerSource
}

export function hasModel(spec: OpenAPISpec, name: string): boolean {
  if (!name) return false
  return !!(spec.components?.schemas?.[name] || spec.definitions?.[name])
}

export function reducer(state: OpenAPIState, action: Action): OpenAPIState {
  switch (action.type) {
    case "SET_SPEC":
      return {
        ...state,
        spec: action.spec,
        sourceSpec: action.sourceSpec ?? action.spec,
        specType: "openapi",
        activeModelName: hasModel(action.spec, state.activeModelName) ? state.activeModelName : "",
        activeSchemaName: state.schemaSource === "openapi" && hasModel(action.spec, state.activeSchemaName)
          ? state.activeSchemaName
          : "",
        error: null,
      }

    case "SET_ROUTES": {
      const availableTags = new Set(action.allTags.map(tag => tag.name))
      const activeTags = new Set([...state.activeTags].filter(tag => availableTags.has(tag)))
      const availableRouteKeys = new Set(action.routes.map(getParsedRouteKey))
      return {
        ...state,
        routes: action.routes,
        allTags: action.allTags,
        modelRouteMap: action.modelRouteMap,
        selectedRoutes: new Set(),
        activeTags,
        activeEndpointKey: availableRouteKeys.has(state.activeEndpointKey) ? state.activeEndpointKey : "",
      }
    }

    case "TOGGLE_ROUTE": {
      const next = new Set(state.selectedRoutes)
      if (next.has(action.index)) next.delete(action.index)
      else next.add(action.index)
      return { ...state, selectedRoutes: next }
    }

    case "SELECT_ROUTES": {
      const next = new Set(state.selectedRoutes)
      for (const i of action.indices) next.add(i)
      return { ...state, selectedRoutes: next }
    }

    case "DESELECT_ROUTES": {
      const next = new Set(state.selectedRoutes)
      for (const i of action.indices) next.delete(i)
      return { ...state, selectedRoutes: next }
    }

    case "SELECT_ALL_ROUTES": {
      const next = new Set<number>()
      for (let i = 0; i < state.routes.length; i++) next.add(i)
      return { ...state, selectedRoutes: next }
    }

    case "CLEAR_ROUTE_SELECTION":
      return { ...state, selectedRoutes: new Set() }

    case "TOGGLE_MODEL": {
      const next = new Set(state.selectedModels)
      if (next.has(action.name)) next.delete(action.name)
      else next.add(action.name)
      return { ...state, selectedModels: next }
    }

    case "SELECT_ALL_MODELS": {
      return { ...state, selectedModels: new Set(action.names) }
    }

    case "CLEAR_MODEL_SELECTION":
      return { ...state, selectedModels: new Set() }

    case "TOGGLE_TAG": {
      const next = new Set(state.activeTags)
      if (next.has(action.tag)) next.delete(action.tag)
      else next.add(action.tag)
      return { ...state, activeTags: next }
    }

    case "SET_ACTIVE_TAGS":
      return { ...state, activeTags: action.tags }

    case "CLEAR_TAGS":
      return { ...state, activeTags: new Set() }

    case "INVERT_TAGS": {
      const next = new Set(state.activeTags)
      for (const tag of action.visibleTags) {
        if (next.has(tag)) next.delete(tag)
        else next.add(tag)
      }
      return { ...state, activeTags: next }
    }

    case "SET_FILTER":
      return { ...state, filter: action.filter }

    case "SET_ACTIVE_ENDPOINT_KEY":
      return { ...state, activeEndpointKey: action.key }

    case "SET_ENDPOINT_DETAIL_TAB":
      return { ...state, endpointDetailTab: action.tab }

    case "SET_MODEL_FILTER":
      return { ...state, modelFilter: action.filter }

    case "SET_MODEL_VIEW_MODE":
      return { ...state, modelViewMode: action.mode }

    case "SET_ACTIVE_MODEL_NAME":
      return { ...state, activeModelName: action.name }

    case "SET_SCHEMA_FILTER":
      return { ...state, schemaFilter: action.filter }

    case "SET_SCHEMA_CATEGORY_FILTER":
      return { ...state, schemaCategoryFilter: action.filter }

    case "SET_SCHEMA_TYPE_FILTER":
      return { ...state, schemaTypeFilter: action.filter }

    case "SET_ACTIVE_SCHEMA_NAME":
      return { ...state, activeSchemaName: action.name }

    case "SET_SCHEMA_SOURCE":
      return {
        ...state,
        schemaSource: action.source,
        schemaCategoryFilter: "",
        schemaTypeFilter: "",
        activeSchemaName: "",
      }

    case "SET_MAIN_VIEW":
      return { ...state, mainView: action.view }

    case "SET_BASE_URL":
      return { ...state, baseUrl: action.url }

    case "SET_SPEC_URL":
      return { ...state, specUrl: action.url }

    case "SET_LOADING":
      return { ...state, loading: action.loading }

    case "SET_ERROR":
      return { ...state, error: action.error }

    case "APPLY_URL_STATE":
      return {
        ...state,
        mainView: action.urlState.mainView,
        filter: action.urlState.filter,
        activeTags: action.urlState.activeTags,
        activeEndpointKey: action.urlState.activeEndpointKey,
        endpointDetailTab: action.urlState.endpointDetailTab,
        modelFilter: action.urlState.modelFilter,
        modelViewMode: action.urlState.modelViewMode,
        activeModelName: action.urlState.activeModelName,
        schemaFilter: action.urlState.schemaFilter,
        schemaCategoryFilter: action.urlState.schemaCategoryFilter,
        schemaTypeFilter: action.urlState.schemaTypeFilter,
        activeSchemaName: action.urlState.activeSchemaName,
        schemaSource: action.urlState.schemaSource,
      }

    case "SET_SPEC_TYPE":
      return { ...state, specType: action.specType }

    case "RESET":
      return { ...initialState }

    default:
      return state
  }
}

export const initialState: OpenAPIState = {
  spec: null,
  sourceSpec: null,
  routes: [],
  modelRouteMap: { modelToRoutes: {}, routeToModels: {} },
  selectedRoutes: new Set(),
  selectedModels: new Set(),
  activeTags: new Set(),
  allTags: [],
  filter: "",
  activeEndpointKey: "",
  endpointDetailTab: "doc",
  modelFilter: "",
  modelViewMode: "list",
  activeModelName: "",
  schemaFilter: "",
  schemaCategoryFilter: "",
  schemaTypeFilter: "",
  activeSchemaName: "",
  schemaSource: "openapi",
  specType: null,
  mainView: "endpoints",
  baseUrl: "",
  specUrl: "",
  loading: false,
  error: null,
}

interface OpenAPIContextValue {
  state: OpenAPIState
  dispatch: React.Dispatch<Action>
  toggleRoute: (index: number) => void
  selectRoutes: (indices: number[]) => void
  deselectRoutes: (indices: number[]) => void
  selectAllRoutes: () => void
  clearRouteSelection: () => void
  toggleModel: (name: string) => void
  selectAllModels: (names: string[]) => void
  clearModelSelection: () => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  invertTags: (visibleTags: string[]) => void
  setFilter: (filter: string) => void
  setActiveEndpointKey: (key: string) => void
  setEndpointDetailTab: (tab: EndpointDetailTab) => void
  setModelFilter: (filter: string) => void
  setModelViewMode: (mode: ModelViewMode) => void
  setActiveModelName: (name: string) => void
  setSchemaFilter: (filter: string) => void
  setSchemaCategoryFilter: (filter: string) => void
  setSchemaTypeFilter: (filter: string) => void
  setActiveSchemaName: (name: string) => void
  setSchemaSource: (source: SchemaViewerSource) => void
  setMainView: (view: MainView) => void
  setBaseUrl: (url: string) => void
  setSpecUrl: (url: string) => void
}

const OpenAPIContext = createContext<OpenAPIContextValue | null>(null)

export function OpenAPIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const toggleRoute = useCallback((index: number) => {
    dispatch({ type: "TOGGLE_ROUTE", index })
  }, [])

  const selectRoutes = useCallback((indices: number[]) => {
    dispatch({ type: "SELECT_ROUTES", indices })
  }, [])

  const deselectRoutes = useCallback((indices: number[]) => {
    dispatch({ type: "DESELECT_ROUTES", indices })
  }, [])

  const selectAllRoutes = useCallback(() => {
    dispatch({ type: "SELECT_ALL_ROUTES" })
  }, [])

  const clearRouteSelection = useCallback(() => {
    dispatch({ type: "CLEAR_ROUTE_SELECTION" })
  }, [])

  const toggleModel = useCallback((name: string) => {
    dispatch({ type: "TOGGLE_MODEL", name })
  }, [])

  const selectAllModels = useCallback((names: string[]) => {
    dispatch({ type: "SELECT_ALL_MODELS", names })
  }, [])

  const clearModelSelection = useCallback(() => {
    dispatch({ type: "CLEAR_MODEL_SELECTION" })
  }, [])

  const toggleTag = useCallback((tag: string) => {
    dispatch({ type: "TOGGLE_TAG", tag })
  }, [])

  const clearTags = useCallback(() => {
    dispatch({ type: "CLEAR_TAGS" })
  }, [])

  const invertTags = useCallback((visibleTags: string[]) => {
    dispatch({ type: "INVERT_TAGS", visibleTags })
  }, [])

  const setFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_FILTER", filter })
  }, [])

  const setActiveEndpointKey = useCallback((key: string) => {
    dispatch({ type: "SET_ACTIVE_ENDPOINT_KEY", key })
  }, [])

  const setEndpointDetailTab = useCallback((tab: EndpointDetailTab) => {
    dispatch({ type: "SET_ENDPOINT_DETAIL_TAB", tab })
  }, [])

  const setModelFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_MODEL_FILTER", filter })
  }, [])

  const setModelViewMode = useCallback((mode: ModelViewMode) => {
    dispatch({ type: "SET_MODEL_VIEW_MODE", mode })
  }, [])

  const setActiveModelName = useCallback((name: string) => {
    dispatch({ type: "SET_ACTIVE_MODEL_NAME", name })
  }, [])

  const setSchemaFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_SCHEMA_FILTER", filter })
  }, [])

  const setSchemaCategoryFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_SCHEMA_CATEGORY_FILTER", filter })
  }, [])

  const setSchemaTypeFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_SCHEMA_TYPE_FILTER", filter })
  }, [])

  const setActiveSchemaName = useCallback((name: string) => {
    dispatch({ type: "SET_ACTIVE_SCHEMA_NAME", name })
  }, [])

  const setSchemaSource = useCallback((source: SchemaViewerSource) => {
    dispatch({ type: "SET_SCHEMA_SOURCE", source })
  }, [])

  const setMainView = useCallback((view: MainView) => {
    dispatch({ type: "SET_MAIN_VIEW", view })
  }, [])

  const setBaseUrl = useCallback((url: string) => {
    dispatch({ type: "SET_BASE_URL", url })
  }, [])

  const setSpecUrl = useCallback((url: string) => {
    dispatch({ type: "SET_SPEC_URL", url })
  }, [])

  const value: OpenAPIContextValue = {
    state,
    dispatch,
    toggleRoute,
    selectRoutes,
    deselectRoutes,
    selectAllRoutes,
    clearRouteSelection,
    toggleModel,
    selectAllModels,
    clearModelSelection,
    toggleTag,
    clearTags,
    invertTags,
    setFilter,
    setActiveEndpointKey,
    setEndpointDetailTab,
    setModelFilter,
    setModelViewMode,
    setActiveModelName,
    setSchemaFilter,
    setSchemaCategoryFilter,
    setSchemaTypeFilter,
    setActiveSchemaName,
    setSchemaSource,
    setMainView,
    setBaseUrl,
    setSpecUrl,
  }

  return (
    <OpenAPIContext.Provider value={value}>
      {children}
    </OpenAPIContext.Provider>
  )
}

export function useOpenAPIContext() {
  const ctx = useContext(OpenAPIContext)
  if (!ctx) throw new Error("useOpenAPIContext must be used within OpenAPIProvider")
  return ctx
}
