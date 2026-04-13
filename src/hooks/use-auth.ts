import { useState, useCallback } from "react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import type { AuthType } from "@/lib/openapi/types"

export function useAuth() {
  const { state } = useOpenAPIContext()

  const [authType, setAuthType] = useState<AuthType>("none")
  const [authToken, setAuthToken] = useState("")
  const [authUser, setAuthUser] = useState("")
  const [authKeyName, setAuthKeyName] = useState("")
  const [oauth2Token, setOAuth2Token] = useState<string | null>(null)
  const [oauth2Loading, setOAuth2Loading] = useState(false)

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (authType === "bearer" && authToken) {
      return { Authorization: `Bearer ${authToken}` }
    }
    if (authType === "oauth2" && oauth2Token) {
      return { Authorization: `Bearer ${oauth2Token}` }
    }
    if (authType === "basic") {
      return { Authorization: `Basic ${btoa(authUser + ":" + authToken)}` }
    }
    if (authType === "apikey" && authToken) {
      const name = authKeyName || "X-API-Key"
      return { [name]: authToken }
    }
    return {}
  }, [authType, authToken, authUser, authKeyName, oauth2Token])

  const oauth2Login = useCallback(async (
    user: string,
    pass: string,
    tokenUrl: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user || !pass) return { success: false, error: "请输入用户名和密码" }
    if (!tokenUrl) return { success: false, error: "Token URL 为空" }

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
      if (!token) throw new Error("响应中无 access_token")
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

  const restoreAuth = useCallback((saved: {
    authType?: string
    authToken?: string
    authUser?: string
    authKeyName?: string
    oauth2Token?: string
  }) => {
    if (saved.authType) setAuthType(saved.authType as AuthType)
    if (saved.authToken) setAuthToken(saved.authToken)
    if (saved.authUser) setAuthUser(saved.authUser)
    if (saved.authKeyName) setAuthKeyName(saved.authKeyName)
    if (saved.oauth2Token) setOAuth2Token(saved.oauth2Token)
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
