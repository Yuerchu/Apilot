import { describe, expect, it } from "vitest"
import { buildSnippet, SNIPPET_TARGETS } from "@/lib/build-snippet"

describe("buildSnippet", () => {
  it("generates curl by default", async () => {
    const result = await buildSnippet("GET", "https://api.test/users", {})
    expect(result).toContain("curl")
    expect(result).toContain("https://api.test/users")
  })

  it("includes headers in curl output", async () => {
    const result = await buildSnippet("GET", "https://api.test/users", {
      Authorization: "Bearer token123",
    })
    expect(result).toContain("Authorization")
    expect(result).toContain("Bearer token123")
  })

  it("includes body in POST curl", async () => {
    const result = await buildSnippet(
      "POST",
      "https://api.test/users",
      { "Content-Type": "application/json" },
      '{"name":"test"}',
    )
    expect(result).toContain("POST")
    expect(result).toContain("name")
  })

  it("generates Python requests snippet", async () => {
    const result = await buildSnippet(
      "GET",
      "https://api.test/items",
      {},
      null,
      "python-requests",
    )
    expect(result).toContain("requests")
  })

  it("generates JavaScript fetch snippet", async () => {
    const result = await buildSnippet(
      "GET",
      "https://api.test/items",
      {},
      null,
      "javascript-fetch",
    )
    expect(result).toContain("fetch")
  })

  it("falls back to unknown target gracefully", async () => {
    const result = await buildSnippet(
      "GET",
      "https://api.test/items",
      { Accept: "application/json" },
      null,
      "nonexistent-target",
    )
    // Should fall back to first target (curl) or fallback curl
    expect(result).toContain("https://api.test/items")
  })

  it("SNIPPET_TARGETS contains expected entries", () => {
    const ids = SNIPPET_TARGETS.map(t => t.id)
    expect(ids).toContain("shell-curl")
    expect(ids).toContain("python-requests")
    expect(ids).toContain("javascript-fetch")
    expect(ids).toContain("go-native")
    expect(SNIPPET_TARGETS.length).toBeGreaterThanOrEqual(15)
  })
})
