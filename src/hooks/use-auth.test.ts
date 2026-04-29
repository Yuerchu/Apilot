import { describe, expect, it } from "vitest"
import { normalizeRestoredAuth } from "@/lib/auth-state"

describe("normalizeRestoredAuth", () => {
  it("uses empty values as real restored state", () => {
    expect(normalizeRestoredAuth({
      authType: "none",
      authToken: "",
      authUser: "",
      authKeyName: "",
      oauth2Token: null,
    })).toEqual({
      authType: "none",
      authToken: "",
      authUser: "",
      authKeyName: "",
      oauth2Token: null,
    })
  })

  it("fills missing fields with the no-auth state", () => {
    expect(normalizeRestoredAuth({})).toEqual({
      authType: "none",
      authToken: "",
      authUser: "",
      authKeyName: "",
      oauth2Token: null,
    })
  })
})
