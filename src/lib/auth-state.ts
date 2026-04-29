import type { AuthType } from "@/lib/openapi/types"

export interface RestoredAuthState {
  authType: AuthType
  authToken: string
  authUser: string
  authKeyName: string
  oauth2Token: string | null
}

export function normalizeRestoredAuth(saved: Partial<RestoredAuthState>): RestoredAuthState {
  return {
    authType: saved.authType ?? "none",
    authToken: saved.authToken ?? "",
    authUser: saved.authUser ?? "",
    authKeyName: saved.authKeyName ?? "",
    oauth2Token: saved.oauth2Token ?? null,
  }
}
