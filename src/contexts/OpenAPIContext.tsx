import { createContext, useContext, useReducer, useCallback } from "react"
import type { ReactNode } from "react"
import type {
  OpenAPISpec,
  ParsedRoute,
  MainView,
  TagInfo,
  ModelRouteMap,
} from "@/lib/openapi/types"

interface OpenAPIState {
  spec: OpenAPISpec | null
  routes: ParsedRoute[]
  modelRouteMap: ModelRouteMap
  selectedRoutes: Set<number>
  selectedModels: Set<string>
  activeTags: Set<string>
  allTags: TagInfo[]
  filter: string
  mainView: MainView
  baseUrl: string
  specUrl: string
  loading: boolean
  error: string | null
}

type Action =
  | { type: "SET_SPEC"; spec: OpenAPISpec }
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
  | { type: "SET_MAIN_VIEW"; view: MainView }
  | { type: "SET_BASE_URL"; url: string }
  | { type: "SET_SPEC_URL"; url: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" }

function reducer(state: OpenAPIState, action: Action): OpenAPIState {
  switch (action.type) {
    case "SET_SPEC":
      return { ...state, spec: action.spec, error: null }

    case "SET_ROUTES": {
      return {
        ...state,
        routes: action.routes,
        allTags: action.allTags,
        modelRouteMap: action.modelRouteMap,
        selectedRoutes: new Set(),
        activeTags: new Set(),
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

    case "RESET":
      return { ...initialState }

    default:
      return state
  }
}

const initialState: OpenAPIState = {
  spec: null,
  routes: [],
  modelRouteMap: { modelToRoutes: {}, routeToModels: {} },
  selectedRoutes: new Set(),
  selectedModels: new Set(),
  activeTags: new Set(),
  allTags: [],
  filter: "",
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
