import { describe, expect, it } from "vitest"
import { findTokenFields, buildAuthHeaders } from "@/lib/request-utils"

describe("findTokenFields", () => {
  it("finds access_token at top level", () => {
    const result = findTokenFields(JSON.stringify({ access_token: "abcdefgh12345678" }))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ key: "access_token", value: "abcdefgh12345678", priority: 1 })
  })

  it("finds nested token fields", () => {
    const result = findTokenFields(JSON.stringify({
      data: { token: "my-secret-token-value" },
    }))
    expect(result).toHaveLength(1)
    expect(result[0]?.key).toBe("data.token")
  })

  it("sorts by priority (access_token before refresh_token)", () => {
    const result = findTokenFields(JSON.stringify({
      refresh_token: "refresh-token-value-long",
      access_token: "access-token-value-long",
    }))
    expect(result[0]?.key).toBe("access_token")
    expect(result[1]?.key).toBe("refresh_token")
  })

  it("ignores short values (< 8 chars)", () => {
    const result = findTokenFields(JSON.stringify({ token: "short" }))
    expect(result).toHaveLength(0)
  })

  it("ignores non-string values", () => {
    const result = findTokenFields(JSON.stringify({ token: 12345678 }))
    expect(result).toHaveLength(0)
  })

  it("ignores arrays", () => {
    const result = findTokenFields(JSON.stringify({ token: ["abcdefgh"] }))
    expect(result).toHaveLength(0)
  })

  it("returns empty for invalid JSON", () => {
    expect(findTokenFields("not json")).toEqual([])
  })

  it("returns empty for non-object JSON", () => {
    expect(findTokenFields('"just a string"')).toEqual([])
    expect(findTokenFields("42")).toEqual([])
    expect(findTokenFields("null")).toEqual([])
  })

  it("finds multiple token types in nested objects", () => {
    const result = findTokenFields(JSON.stringify({
      access_token: "primary-access-token",
      auth: { api_key: "my-api-key-value-here" },
    }))
    expect(result).toHaveLength(2)
    expect(result[0]?.priority).toBeLessThan(result[1]!.priority)
  })
})

describe("buildAuthHeaders", () => {
  it("returns empty object for none auth", () => {
    expect(buildAuthHeaders("none", "", "", "", null)).toEqual({})
  })

  it("returns bearer token header", () => {
    expect(buildAuthHeaders("bearer", "my-token", "", "", null)).toEqual({
      Authorization: "Bearer my-token",
    })
  })

  it("returns empty for bearer with no token", () => {
    expect(buildAuthHeaders("bearer", "", "", "", null)).toEqual({})
  })

  it("returns oauth2 bearer header", () => {
    expect(buildAuthHeaders("oauth2", "", "", "", "oauth-token")).toEqual({
      Authorization: "Bearer oauth-token",
    })
  })

  it("returns basic auth header", () => {
    const result = buildAuthHeaders("basic", "pass", "user", "", null)
    expect(result.Authorization).toBe(`Basic ${btoa("user:pass")}`)
  })

  it("returns apikey header with custom name", () => {
    expect(buildAuthHeaders("apikey", "key123", "", "X-Custom-Key", null)).toEqual({
      "X-Custom-Key": "key123",
    })
  })

  it("uses X-API-Key as default apikey header name", () => {
    expect(buildAuthHeaders("apikey", "key123", "", "", null)).toEqual({
      "X-API-Key": "key123",
    })
  })

  it("returns empty for apikey with no token", () => {
    expect(buildAuthHeaders("apikey", "", "", "X-Key", null)).toEqual({})
  })
})
