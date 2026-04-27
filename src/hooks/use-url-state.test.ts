import { describe, expect, it } from "vitest"
import { buildHashState, parseHashState } from "@/hooks/use-url-state"
import type { UrlState } from "@/contexts/OpenAPIContext"

function makeUrlState(overrides: Partial<UrlState> = {}): UrlState {
  return {
    mainView: "endpoints",
    filter: "",
    activeTags: new Set(),
    activeEndpointKey: "",
    endpointDetailTab: "doc",
    modelFilter: "",
    modelViewMode: "list",
    activeModelName: "",
    schemaFilter: "",
    schemaCategoryFilter: "",
    schemaTypeFilter: "",
    activeSchemaName: "",
    schemaSource: "openapi",
    ...overrides,
  }
}

describe("url state", () => {
  it("parses endpoint filters, selected tags, active endpoint, and tab", () => {
    const state = parseHashState("#/endpoints?q=user&tag=beta&tag=admin&endpoint=get%3A%2Fusers&tab=try")

    expect(state.mainView).toBe("endpoints")
    expect(state.filter).toBe("user")
    expect([...state.activeTags].sort()).toEqual(["admin", "beta"])
    expect(state.activeEndpointKey).toBe("get:/users")
    expect(state.endpointDetailTab).toBe("try")
  })

  it("builds stable endpoint hashes with sorted tag params", () => {
    const hash = buildHashState(makeUrlState({
      activeEndpointKey: "get:/users",
      activeTags: new Set(["beta", "admin"]),
      endpointDetailTab: "try",
      filter: "user",
    }))

    expect(hash).toBe("#/endpoints?q=user&tag=admin&tag=beta&endpoint=get%3A%2Fusers&tab=try")
  })

  it("round-trips schema graph mode", () => {
    const hash = buildHashState(makeUrlState({
      mainView: "models",
      modelViewMode: "graph",
    }))

    expect(hash).toBe("#/models?mode=graph")
    expect(parseHashState(hash)).toMatchObject({
      mainView: "models",
      modelViewMode: "graph",
    })
  })

  it("round-trips schema viewer source, filter, and selected schema", () => {
    const hash = buildHashState(makeUrlState({
      mainView: "models",
      schemaFilter: "generation",
      schemaCategoryFilter: "chat_completion",
      schemaTypeFilter: "text",
      schemaSource: "external",
      activeSchemaName: "TextGenerationRequest",
    }))

    expect(hash).toBe("#/models?q=generation&category=chat_completion&type=text&schema=TextGenerationRequest&source=external")
    expect(parseHashState(hash)).toMatchObject({
      mainView: "models",
      schemaFilter: "generation",
      schemaCategoryFilter: "chat_completion",
      schemaTypeFilter: "text",
      schemaSource: "external",
      activeSchemaName: "TextGenerationRequest",
    })
  })

  it("maps legacy tools hash links to the split tool pages", () => {
    expect(parseHashState("#/tools").mainView).toBe("diagnostics")
    expect(parseHashState("#/tools?tab=diff").mainView).toBe("diff")
  })
})
