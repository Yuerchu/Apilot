import { useEffect, useRef } from "react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { readLegacySettingsFromLocalStorage } from "@/lib/db"
import type { AuthType } from "@/lib/openapi/types"

interface AuthSetters {
  setAuthType: (t: AuthType) => void
  setAuthToken: (t: string) => void
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
      const authType = params.get("auth_type") as AuthType | null
      const authToken = params.get("auth_token") || ""

      if (specUrl) dispatch({ type: "SET_SPEC_URL", url: specUrl })
      if (baseUrl) dispatch({ type: "SET_BASE_URL", url: baseUrl })
      if (authType && authType !== "none") auth.setAuthType(authType)
      if (authToken) auth.setAuthToken(authToken)

      const title = params.get("title")
      if (title) document.title = title

      if (specUrl && autoLoad) {
        setTimeout(() => {
          autoLoad(specUrl, baseUrl ? { baseUrlOverride: baseUrl } : undefined)
        }, 0)
      }
    })()

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
