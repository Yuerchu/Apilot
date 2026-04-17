import { describe, expect, it } from "vitest"
import { getRouteKey, getParsedRouteKey } from "@/lib/openapi/route-key"
import type { ParsedRoute } from "@/lib/openapi/types"

describe("route-key", () => {
  it("getRouteKey lowercases method", () => {
    expect(getRouteKey("GET", "/users")).toBe("get:/users")
    expect(getRouteKey("Post", "/items")).toBe("post:/items")
  })

  it("getParsedRouteKey delegates to getRouteKey", () => {
    const route = { method: "DELETE", path: "/users/{id}" } as ParsedRoute
    expect(getParsedRouteKey(route)).toBe("delete:/users/{id}")
  })
})
