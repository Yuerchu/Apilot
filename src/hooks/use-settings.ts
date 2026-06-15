import { useEffect, useRef } from "react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { authTypeValue, readLegacySettingsFromLocalStorage } from "@/lib/db"
import { isPrivateOrLocalHost } from "@/lib/openapi/url-guard"
import type { AuthType } from "@/lib/openapi/types"

interface AuthSetters {
  setAuthType: (t: AuthType) => void
}

// Query params that must never linger in the address bar (history / Referer / proxy logs).
const SENSITIVE_QUERY_PARAMS = ["auth_token", "auth_type"]

function stripSensitiveQueryParams(): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return
  try {
    const u = new URL(window.location.href)
    let changed = false
    for (const p of SENSITIVE_QUERY_PARAMS) {
      if (u.searchParams.has(p)) { u.searchParams.delete(p); changed = true }
    }
    if (changed) window.history.replaceState(window.history.state, "", u.toString())
  } catch {
    // ignore malformed URL
  }
}

export function useSettings(
  auth: AuthSetters,
  autoLoad?: (url: string, options?: { baseUrlOverride?: string }) => void,
) {
  const { dispatch } = useOpenAPIContext()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let cancelled = false

    ;(async () => {
      const params = new URLSearchParams(window.location.search)
      const legacy = readLegacySettingsFromLocalStorage()

      if (cancelled) return

      const paramSpecUrl = params.get("openapi_url") || ""
      const specUrl = paramSpecUrl || legacy.specUrl
      const baseUrl = params.get("base_url") || (paramSpecUrl ? "" : legacy.baseUrl)
      // auth_type is a non-secret selector; validate it instead of casting. The
      // auth_token credential is intentionally NOT read from the URL — credentials
      // must never travel via query strings (history / Referer / proxy logs).
      const authType = authTypeValue(params.get("auth_type"))

      if (specUrl) dispatch({ type: "SET_SPEC_URL", url: specUrl })
      if (baseUrl) dispatch({ type: "SET_BASE_URL", url: baseUrl })
      if (authType !== "none") auth.setAuthType(authType)

      // Remove sensitive params from the address bar after consuming them.
      stripSensitiveQueryParams()

      const title = params.get("title")
      if (title) document.title = title

      if (specUrl && autoLoad) {
        // A spec URL taken from the query string is attacker-controllable (share
        // link) and auto-fetched without interaction — refuse internal/loopback
        // hosts (SSRF). URLs the user typed or previously loaded (legacy) are exempt.
        const fromQuery = !!paramSpecUrl && specUrl === paramSpecUrl
        let blockedHost = false
        if (fromQuery) {
          try { blockedHost = isPrivateOrLocalHost(new URL(specUrl).hostname) } catch { blockedHost = true }
        }
        if (blockedHost) {
          console.warn(`[apilot] refused to auto-load spec from an internal/loopback host: ${specUrl}`)
        } else {
          setTimeout(() => {
            autoLoad(specUrl, baseUrl ? { baseUrlOverride: baseUrl } : undefined)
          }, 0)
        }
      }
    })()

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
