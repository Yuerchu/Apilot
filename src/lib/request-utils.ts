const TOKEN_KEYS_PRIO: Record<string, number> = {
  access_token: 1, accessToken: 1, token: 2, jwt: 2, bearer: 2,
  id_token: 3, auth_token: 3, authToken: 3, session_token: 4,
  api_key: 5, apiKey: 5, refresh_token: 9,
}

export function findTokenFields(jsonBody: string): Array<{ key: string; value: string; priority: number }> {
  try {
    const obj = JSON.parse(jsonBody)
    if (typeof obj !== "object" || obj === null) return []

    const found: Array<{ key: string; value: string; priority: number }> = []
    const search = (o: Record<string, unknown>, path: string) => {
      for (const [k, v] of Object.entries(o)) {
        const p = path ? `${path}.${k}` : k
        const priority = TOKEN_KEYS_PRIO[k]
        if (typeof v === "string" && v.length >= 8 && priority !== undefined) {
          found.push({ key: p, value: v, priority })
        } else if (typeof v === "object" && v && !Array.isArray(v)) {
          search(v as Record<string, unknown>, p)
        }
      }
    }
    search(obj, "")
    return found.sort((a, b) => a.priority - b.priority)
  } catch {
    return []
  }
}

export function buildAuthHeaders(
  authType: string,
  authToken: string,
  authUser: string,
  authKeyName: string,
  oauth2Token: string | null,
): Record<string, string> {
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
}
