import { useEffect, useRef } from "react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import type { AuthType } from "@/lib/openapi/types"

const LS_KEYS = {
  url: "oa_specUrl",
  base: "oa_baseUrl",
  authType: "oa_authType",
  authToken: "oa_authToken",
  authUser: "oa_authUser",
  authKeyName: "oa_authKeyName",
  oauth2Token: "oa_oauth2Token",
} as const

interface AuthState {
  authType: AuthType
  authToken: string
  authUser: string
  authKeyName: string
  oauth2Token: string | null
}

interface SettingsSnapshot {
  specUrl: string
  baseUrl: string
  auth: AuthState
}

function saveToStorage(snapshot: SettingsSnapshot) {
  localStorage.setItem(LS_KEYS.url, snapshot.specUrl)
  localStorage.setItem(LS_KEYS.base, snapshot.baseUrl)
  localStorage.setItem(LS_KEYS.authType, snapshot.auth.authType)
  localStorage.setItem(LS_KEYS.authToken, snapshot.auth.authToken)
  localStorage.setItem(LS_KEYS.authUser, snapshot.auth.authUser)
  localStorage.setItem(LS_KEYS.authKeyName, snapshot.auth.authKeyName)
  if (snapshot.auth.oauth2Token) {
    localStorage.setItem(LS_KEYS.oauth2Token, snapshot.auth.oauth2Token)
  }
}

function loadFromStorage(): {
  specUrl: string
  baseUrl: string
  authType: AuthType
  authToken: string
  authUser: string
  authKeyName: string
  oauth2Token: string | null
} {
  return {
    specUrl: localStorage.getItem(LS_KEYS.url) || "",
    baseUrl: localStorage.getItem(LS_KEYS.base) || "",
    authType: (localStorage.getItem(LS_KEYS.authType) as AuthType) || "none",
    authToken: localStorage.getItem(LS_KEYS.authToken) || "",
    authUser: localStorage.getItem(LS_KEYS.authUser) || "",
    authKeyName: localStorage.getItem(LS_KEYS.authKeyName) || "",
    oauth2Token: localStorage.getItem(LS_KEYS.oauth2Token),
  }
}

export function useSettings(auth: AuthState) {
  const { state, dispatch } = useOpenAPIContext()
  const initialized = useRef(false)

  // Restore on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const saved = loadFromStorage()
    if (saved.specUrl) dispatch({ type: "SET_SPEC_URL", url: saved.specUrl })
    if (saved.baseUrl) dispatch({ type: "SET_BASE_URL", url: saved.baseUrl })

    return undefined
  }, [dispatch])

  // Auto-save on state changes
  useEffect(() => {
    if (!initialized.current) return
    saveToStorage({
      specUrl: state.specUrl,
      baseUrl: state.baseUrl,
      auth,
    })
  }, [state.specUrl, state.baseUrl, auth])

  return {
    loadFromStorage,
    saveNow: () => saveToStorage({
      specUrl: state.specUrl,
      baseUrl: state.baseUrl,
      auth,
    }),
  }
}
