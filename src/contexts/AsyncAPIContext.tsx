import { createContext, useContext, useReducer, useCallback } from "react"
import type { ReactNode } from "react"
import type { ChannelDetailTab, TagInfo } from "@/lib/openapi/types"
import type { ParsedChannel, ParsedServerInfo, ParsedAsyncAPIResult, AsyncAPISpec, AsyncAPISpecInfo } from "@/lib/asyncapi/types"
import type { SchemaObject } from "@/lib/openapi/types"

interface AsyncAPIState {
  spec: AsyncAPISpec | null
  channels: ParsedChannel[]
  schemas: Record<string, SchemaObject>
  servers: ParsedServerInfo[]
  info: AsyncAPISpecInfo | null
  allTags: TagInfo[]
  filter: string
  activeTags: Set<string>
  activeChannelId: string
  channelDetailTab: ChannelDetailTab
}

type Action =
  | { type: "SET_PARSED_RESULT"; result: ParsedAsyncAPIResult }
  | { type: "SET_FILTER"; filter: string }
  | { type: "TOGGLE_TAG"; tag: string }
  | { type: "SET_ACTIVE_TAGS"; tags: Set<string> }
  | { type: "CLEAR_TAGS" }
  | { type: "SET_ACTIVE_CHANNEL_ID"; id: string }
  | { type: "SET_CHANNEL_DETAIL_TAB"; tab: ChannelDetailTab }
  | { type: "RESET" }

const initialState: AsyncAPIState = {
  spec: null,
  channels: [],
  schemas: {},
  servers: [],
  info: null,
  allTags: [],
  filter: "",
  activeTags: new Set(),
  activeChannelId: "",
  channelDetailTab: "doc",
}

function reducer(state: AsyncAPIState, action: Action): AsyncAPIState {
  switch (action.type) {
    case "SET_PARSED_RESULT":
      return {
        ...state,
        spec: action.result.raw,
        channels: action.result.channels,
        schemas: action.result.schemas,
        servers: action.result.servers,
        info: action.result.info,
        allTags: action.result.allTags,
        activeChannelId: action.result.channels.length > 0 ? (action.result.channels[0]?.id ?? "") : "",
      }

    case "SET_FILTER":
      return { ...state, filter: action.filter }

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

    case "SET_ACTIVE_CHANNEL_ID":
      return { ...state, activeChannelId: action.id }

    case "SET_CHANNEL_DETAIL_TAB":
      return { ...state, channelDetailTab: action.tab }

    case "RESET":
      return { ...initialState }

    default:
      return state
  }
}

interface AsyncAPIContextValue {
  state: AsyncAPIState
  dispatch: React.Dispatch<Action>
  setFilter: (filter: string) => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  setActiveChannelId: (id: string) => void
  setChannelDetailTab: (tab: ChannelDetailTab) => void
}

const AsyncAPIContext = createContext<AsyncAPIContextValue | null>(null)

export function AsyncAPIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const setFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_FILTER", filter })
  }, [])

  const toggleTag = useCallback((tag: string) => {
    dispatch({ type: "TOGGLE_TAG", tag })
  }, [])

  const clearTags = useCallback(() => {
    dispatch({ type: "CLEAR_TAGS" })
  }, [])

  const setActiveChannelId = useCallback((id: string) => {
    dispatch({ type: "SET_ACTIVE_CHANNEL_ID", id })
  }, [])

  const setChannelDetailTab = useCallback((tab: ChannelDetailTab) => {
    dispatch({ type: "SET_CHANNEL_DETAIL_TAB", tab })
  }, [])

  const value: AsyncAPIContextValue = {
    state,
    dispatch,
    setFilter,
    toggleTag,
    clearTags,
    setActiveChannelId,
    setChannelDetailTab,
  }

  return (
    <AsyncAPIContext.Provider value={value}>
      {children}
    </AsyncAPIContext.Provider>
  )
}

export function useAsyncAPIContext() {
  const ctx = useContext(AsyncAPIContext)
  if (!ctx) throw new Error("useAsyncAPIContext must be used within AsyncAPIProvider")
  return ctx
}
