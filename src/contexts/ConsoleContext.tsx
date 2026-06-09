import { createContext, useContext, useReducer, useMemo, type Dispatch, type ReactNode } from "react"
import type { ParsedRoute } from "@/lib/openapi/types"
import type { ConsoleResource, ConsoleResourceGroup } from "@/lib/console/types"
import { groupRoutes, groupResourcesByPrefix } from "@/lib/console/resource-grouper"

export type ConsoleSubView = "list" | "detail" | "create" | "edit"

export interface ConsoleState {
  activeResourceName: string | null
  subView: ConsoleSubView
  activeItemId: string | null
  builderMode: boolean
}

type ConsoleAction =
  | { type: "SET_ACTIVE_RESOURCE"; name: string }
  | { type: "SET_SUB_VIEW"; view: ConsoleSubView; itemId?: string | null }
  | { type: "SET_BUILDER_MODE"; on: boolean }

const initialState: ConsoleState = {
  activeResourceName: null,
  subView: "list",
  activeItemId: null,
  builderMode: false,
}

function reducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case "SET_ACTIVE_RESOURCE":
      return { ...state, activeResourceName: action.name, subView: "list", activeItemId: null }
    case "SET_SUB_VIEW":
      return { ...state, subView: action.view, activeItemId: action.itemId ?? null }
    case "SET_BUILDER_MODE":
      return { ...state, builderMode: action.on }
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
}

const ConsoleCtx = createContext<ConsoleContextValue | null>(null)

export function ConsoleProvider({ routes, children }: { routes: ParsedRoute[]; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const resources = useMemo(() => groupRoutes(routes), [routes])
  const groups = useMemo(() => groupResourcesByPrefix(resources), [resources])
  const activeResource = useMemo(
    () => resources.find(r => r.name === state.activeResourceName) ?? null,
    [resources, state.activeResourceName],
  )

  return (
    <ConsoleCtx.Provider value={{ state, dispatch, resources, groups, activeResource }}>
      {children}
    </ConsoleCtx.Provider>
  )
}

export function useConsoleContext() {
  const ctx = useContext(ConsoleCtx)
  if (!ctx) throw new Error("useConsoleContext must be used within ConsoleProvider")
  return ctx
}
