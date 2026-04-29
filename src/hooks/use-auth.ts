import { useState, useCallback } from "react"
import i18n from "@/lib/i18n"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { normalizeRestoredAuth, type RestoredAuthState } from "@/lib/auth-state"
import { buildAuthHeaders } from "@/lib/request-utils"
import type { AuthType } from "@/lib/openapi/types"

export function useAuth() {
  const { state } = useOpenAPIContext()

  const [authType, setAuthType] = useState<AuthType>("none")
  const [authToken, setAuthToken] = useState("")
  const [authUser, setAuthUser] = useState("")
  const [authKeyName, setAuthKeyName] = useState("")
  const [oauth2Token, setOAuth2Token] = useState<string | null>(null)
  const [oauth2Loading, setOAuth2Loading] = useState(false)

  const getAuthHeaders = useCallback(
    () => buildAuthHeaders(authType, authToken, authUser, authKeyName, oauth2Token),
    [authType, authToken, authUser, authKeyName, oauth2Token],
  )

  const oauth2Login = useCallback(async (
    user: string,
    pass: string,
    tokenUrl: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user || !pass) return { success: false, error: i18n.t("validation.enterCredentials") }
    if (!tokenUrl) return { success: false, error: i18n.t("validation.tokenUrlEmpty") }

    let resolvedUrl = tokenUrl
    if (!resolvedUrl.startsWith("http")) {
      const base = state.baseUrl.replace(/\/$/, "")
      resolvedUrl = base + (resolvedUrl.startsWith("/") ? "" : "/") + resolvedUrl
    }

    setOAuth2Loading(true)
    try {
      const body = new URLSearchParams({ grant_type: "password", username: user, password: pass })
      const res = await fetch(resolvedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      })
      if (!res.ok) {
        const errText = await res.text()
        let detail = ""
        try {
          detail = JSON.parse(errText).detail || errText
        } catch {
          detail = errText
        }
        throw new Error(`${res.status} ${detail}`.substring(0, 80))
      }
      const data = await res.json()
      const token = data.access_token
      if (!token) throw new Error(i18n.t("validation.noAccessToken"))
      setOAuth2Token(token)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    } finally {
      setOAuth2Loading(false)
    }
  }, [state.baseUrl])

  const applyToken = useCallback((token: string, _fieldName?: string) => {
    setAuthType("bearer")
    setAuthToken(token)
    setOAuth2Token(token)
  }, [])

  const restoreAuth = useCallback((saved: Partial<RestoredAuthState>) => {
    const next = normalizeRestoredAuth(saved)
    setAuthType(next.authType)
    setAuthToken(next.authToken)
    setAuthUser(next.authUser)
    setAuthKeyName(next.authKeyName)
    setOAuth2Token(next.oauth2Token)
  }, [])

  return {
    authType,
    setAuthType,
    authToken,
    setAuthToken,
    authUser,
    setAuthUser,
    authKeyName,
    setAuthKeyName,
    oauth2Token,
    setOAuth2Token,
    oauth2Loading,
    getAuthHeaders,
    oauth2Login,
    applyToken,
    restoreAuth,
  }
}
