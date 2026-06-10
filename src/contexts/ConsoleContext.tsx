import { createContext, useContext, useReducer, useMemo, useEffect, type Dispatch, type ReactNode } from "react"
import type { ParsedRoute } from "@/lib/openapi/types"
import type { ConsoleResource, ConsoleResourceGroup, ResourceLayout, ResourceAction } from "@/lib/console/types"
import { groupRoutes, groupResourcesByPrefix } from "@/lib/console/resource-grouper"
import { loadLayouts } from "@/lib/console/layout-config"

export type ConsoleSubView = "list" | "detail" | "create" | "edit"

export interface ConsoleState {
  activeResourceKey: string | null
  activeActionIndex: number | null
  subView: ConsoleSubView
  activeItemId: string | null
  editingRow: Record<string, unknown> | null
  builderMode: boolean
  layouts: Record<string, ResourceLayout>
}

type ConsoleAction =
  | { type: "SET_ACTIVE_RESOURCE"; key: string }
  | { type: "SET_ACTIVE_ACTION"; key: string; actionIndex: number }
  | { type: "SET_SUB_VIEW"; view: ConsoleSubView; itemId?: string | null; row?: Record<string, unknown> | null }
  | { type: "SET_BUILDER_MODE"; on: boolean }
  | { type: "SET_LAYOUT"; basePath: string; layout: ResourceLayout }
  | { type: "RESET_LAYOUT"; basePath: string }
  | { type: "LOAD_LAYOUTS"; layouts: Record<string, ResourceLayout> }

const initialState: ConsoleState = {
  activeResourceKey: null,
  activeActionIndex: null,
  subView: "list",
  activeItemId: null,
  editingRow: null,
  builderMode: false,
  layouts: {},
}

function reducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case "SET_ACTIVE_RESOURCE":
      return { ...state, activeResourceKey: action.key, activeActionIndex: null, subView: "list", activeItemId: null, editingRow: null }
    case "SET_ACTIVE_ACTION":
      return { ...state, activeResourceKey: action.key, activeActionIndex: action.actionIndex, subView: "list", activeItemId: null, editingRow: null }
    case "SET_SUB_VIEW":
      return { ...state, subView: action.view, activeItemId: action.itemId ?? null, editingRow: action.row ?? null }
    case "SET_BUILDER_MODE":
      return { ...state, builderMode: action.on }
    case "SET_LAYOUT": {
      const layouts = { ...state.layouts, [action.basePath]: action.layout }
      return { ...state, layouts }
    }
    case "RESET_LAYOUT": {
      const layouts = { ...state.layouts }
      delete layouts[action.basePath]
      return { ...state, layouts }
    }
    case "LOAD_LAYOUTS":
      return { ...state, layouts: action.layouts }
    default:
      return state
  }
}

interface ConsoleContextValue {
  state: ConsoleState
  dispatch: Dispatch<ConsoleAction>
  resources: ConsoleResource[]
  groups: ConsoleResourceGroup[]
  activeResource: ConsoleResource | null
  activeAction: ResourceAction | null
  activeLayout: ResourceLayout | null
  specId: string
}

const ConsoleCtx = createContext<ConsoleContextValue | null>(null)

export function ConsoleProvider({ routes, specId, children }: { routes: ParsedRoute[]; specId: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const resources = useMemo(() => groupRoutes(routes), [routes])
  const groups = useMemo(() => groupResourcesByPrefix(resources), [resources])
  const activeResource = useMemo(
    () => resources.find(r => r.basePath === state.activeResourceKey) ?? null,
    [resources, state.activeResourceKey],
  )
  const activeAction = useMemo(
    () => {
      if (state.activeActionIndex === null || !activeResource) return null
      return activeResource.actions[state.activeActionIndex] ?? null
    },
    [activeResource, state.activeActionIndex],
  )
  const activeLayout = useMemo(
    () => (activeResource ? state.layouts[activeResource.basePath] ?? null : null),
    [activeResource, state.layouts],
  )

  useEffect(() => {
    if (!specId) return
    loadLayouts(specId).then(layouts => {
      if (Object.keys(layouts).length > 0) {
        dispatch({ type: "LOAD_LAYOUTS", layouts })
      }
    })
  }, [specId])

  const contextValue = useMemo(() => ({
    state, dispatch, resources, groups, activeResource, activeAction, activeLayout, specId,
  }), [state, dispatch, resources, groups, activeResource, activeAction, activeLayout, specId])

  return (
    <ConsoleCtx.Provider value={contextValue}>
      {children}
    </ConsoleCtx.Provider>
  )
}

export function useConsoleContext() {
  const ctx = useContext(ConsoleCtx)
  if (!ctx) throw new Error("useConsoleContext must be used within ConsoleProvider")
  return ctx
}
