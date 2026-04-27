import { describe, expect, it } from "vitest"
import type { UrlState } from "@/contexts/OpenAPIContext"
import { buildShareLink, buildSharedUrlState } from "@/lib/share-link"

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

describe("share links", () => {
  it("builds a clean link with selected config and location", () => {
    const link = buildShareLink({
      currentHref: "https://app.example/?auth_token=secret#/models?model=Old",
      state: makeUrlState({
        activeEndpointKey: "get:/users",
        endpointDetailTab: "try",
      }),
      specUrl: "https://api.example/openapi.json",
      baseUrl: "https://api.example",
      target: { type: "current" },
      options: {
        includeOpenAPIUrl: true,
        includeBaseUrl: true,
        includeLocation: true,
      },
    })

    expect(link).toBe(
      "https://app.example/?openapi_url=https%3A%2F%2Fapi.example%2Fopenapi.json&base_url=https%3A%2F%2Fapi.example#/endpoints?endpoint=get%3A%2Fusers&tab=try",
    )
  })

  it("uses an endpoint target as the shared location", () => {
    const state = buildSharedUrlState(
      makeUrlState({
        mainView: "models",
        activeSchemaName: "User",
      }),
      { type: "endpoint", endpointKey: "post:/chat", label: "POST /chat" },
    )

    expect(state.mainView).toBe("endpoints")
    expect(state.activeEndpointKey).toBe("post:/chat")
    expect(state.endpointDetailTab).toBe("doc")
  })

  it("does not include an OpenAPI URL for local-file specs", () => {
    const link = buildShareLink({
      currentHref: "file:///C:/tools/index.html#/endpoints",
      state: makeUrlState(),
      specUrl: "",
      baseUrl: "http://localhost:8000",
      target: { type: "current" },
      options: {
        includeOpenAPIUrl: true,
        includeBaseUrl: true,
        includeLocation: false,
      },
    })

    expect(link).toBe("file:///C:/tools/index.html?base_url=http%3A%2F%2Flocalhost%3A8000")
  })
})
