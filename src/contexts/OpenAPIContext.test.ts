import { describe, expect, it } from "vitest"
import { reducer, initialState, hasModel } from "@/contexts/OpenAPIContext"
import type { OpenAPISpec } from "@/lib/openapi/types"

describe("hasModel", () => {
  it("returns false for empty name", () => {
    expect(hasModel({ components: { schemas: { User: {} } } } as OpenAPISpec, "")).toBe(false)
  })

  it("finds model in components.schemas", () => {
    const spec = { components: { schemas: { User: { type: "object" } } } } as OpenAPISpec
    expect(hasModel(spec, "User")).toBe(true)
    expect(hasModel(spec, "Missing")).toBe(false)
  })

  it("finds model in definitions (Swagger 2)", () => {
    const spec = { definitions: { Pet: { type: "object" } } } as OpenAPISpec
    expect(hasModel(spec, "Pet")).toBe(true)
  })
})

describe("reducer", () => {
  it("returns initial state on RESET", () => {
    const modified = { ...initialState, filter: "search", baseUrl: "http://localhost" }
    const result = reducer(modified, { type: "RESET" })
    expect(result.filter).toBe("")
    expect(result.baseUrl).toBe("")
  })

  it("TOGGLE_ROUTE adds and removes route indices", () => {
    let state = reducer(initialState, { type: "TOGGLE_ROUTE", index: 2 })
    expect(state.selectedRoutes.has(2)).toBe(true)

    state = reducer(state, { type: "TOGGLE_ROUTE", index: 2 })
    expect(state.selectedRoutes.has(2)).toBe(false)
  })

  it("SELECT_ROUTES adds multiple indices", () => {
    const state = reducer(initialState, { type: "SELECT_ROUTES", indices: [0, 1, 3] })
    expect([...state.selectedRoutes].sort()).toEqual([0, 1, 3])
  })

  it("DESELECT_ROUTES removes specified indices", () => {
    let state = reducer(initialState, { type: "SELECT_ROUTES", indices: [0, 1, 2, 3] })
    state = reducer(state, { type: "DESELECT_ROUTES", indices: [1, 3] })
    expect([...state.selectedRoutes].sort()).toEqual([0, 2])
  })

  it("SELECT_ALL_ROUTES selects all routes by index", () => {
    const state = reducer(
      { ...initialState, routes: [{}, {}, {}] as never[] },
      { type: "SELECT_ALL_ROUTES" },
    )
    expect(state.selectedRoutes.size).toBe(3)
  })

  it("CLEAR_ROUTE_SELECTION empties selection", () => {
    let state = reducer(initialState, { type: "SELECT_ROUTES", indices: [0, 1] })
    state = reducer(state, { type: "CLEAR_ROUTE_SELECTION" })
    expect(state.selectedRoutes.size).toBe(0)
  })

  it("TOGGLE_MODEL adds and removes model names", () => {
    let state = reducer(initialState, { type: "TOGGLE_MODEL", name: "User" })
    expect(state.selectedModels.has("User")).toBe(true)

    state = reducer(state, { type: "TOGGLE_MODEL", name: "User" })
    expect(state.selectedModels.has("User")).toBe(false)
  })

  it("SELECT_ALL_MODELS and CLEAR_MODEL_SELECTION", () => {
    let state = reducer(initialState, { type: "SELECT_ALL_MODELS", names: ["A", "B", "C"] })
    expect(state.selectedModels.size).toBe(3)

    state = reducer(state, { type: "CLEAR_MODEL_SELECTION" })
    expect(state.selectedModels.size).toBe(0)
  })

  it("TOGGLE_TAG adds and removes tags", () => {
    let state = reducer(initialState, { type: "TOGGLE_TAG", tag: "admin" })
    expect(state.activeTags.has("admin")).toBe(true)

    state = reducer(state, { type: "TOGGLE_TAG", tag: "admin" })
    expect(state.activeTags.has("admin")).toBe(false)
  })

  it("INVERT_TAGS flips tag selection", () => {
    let state = reducer(initialState, { type: "SET_ACTIVE_TAGS", tags: new Set(["a", "b"]) })
    state = reducer(state, { type: "INVERT_TAGS", visibleTags: ["a", "b", "c"] })
    expect([...state.activeTags]).toEqual(["c"])
  })

  it("CLEAR_TAGS empties all active tags", () => {
    let state = reducer(initialState, { type: "SET_ACTIVE_TAGS", tags: new Set(["a"]) })
    state = reducer(state, { type: "CLEAR_TAGS" })
    expect(state.activeTags.size).toBe(0)
  })

  it("SET_FILTER updates filter string", () => {
    const state = reducer(initialState, { type: "SET_FILTER", filter: "users" })
    expect(state.filter).toBe("users")
  })

  it("SET_MAIN_VIEW changes view", () => {
    const state = reducer(initialState, { type: "SET_MAIN_VIEW", view: "models" })
    expect(state.mainView).toBe("models")
  })

  it("SET_BASE_URL and SET_SPEC_URL", () => {
    let state = reducer(initialState, { type: "SET_BASE_URL", url: "http://api.test" })
    expect(state.baseUrl).toBe("http://api.test")

    state = reducer(state, { type: "SET_SPEC_URL", url: "http://api.test/openapi.json" })
    expect(state.specUrl).toBe("http://api.test/openapi.json")
  })

  it("SET_LOADING and SET_ERROR", () => {
    let state = reducer(initialState, { type: "SET_LOADING", loading: true })
    expect(state.loading).toBe(true)

    state = reducer(state, { type: "SET_ERROR", error: "failed" })
    expect(state.error).toBe("failed")
  })

  it("SET_ENDPOINT_DETAIL_TAB changes tab", () => {
    const state = reducer(initialState, { type: "SET_ENDPOINT_DETAIL_TAB", tab: "try" })
    expect(state.endpointDetailTab).toBe("try")
  })

  it("SET_MODEL_VIEW_MODE changes model view", () => {
    const state = reducer(initialState, { type: "SET_MODEL_VIEW_MODE", mode: "graph" })
    expect(state.modelViewMode).toBe("graph")
  })

  it("SET_SCHEMA_SOURCE resets activeSchemaName", () => {
    const state = reducer(
      { ...initialState, activeSchemaName: "Foo" },
      { type: "SET_SCHEMA_SOURCE", source: "external" },
    )
    expect(state.schemaSource).toBe("external")
    expect(state.activeSchemaName).toBe("")
  })

  it("SET_SPEC clears error and validates activeModelName", () => {
    const spec = { components: { schemas: { User: {} } } } as OpenAPISpec
    const state = reducer(
      { ...initialState, activeModelName: "Missing", error: "old error" },
      { type: "SET_SPEC", spec },
    )
    expect(state.spec).toBe(spec)
    expect(state.error).toBeNull()
    expect(state.activeModelName).toBe("")
  })

  it("SET_SPEC preserves activeModelName if model exists", () => {
    const spec = { components: { schemas: { User: {} } } } as OpenAPISpec
    const state = reducer(
      { ...initialState, activeModelName: "User" },
      { type: "SET_SPEC", spec },
    )
    expect(state.activeModelName).toBe("User")
  })

  it("SET_ROUTES filters stale activeTags and activeEndpointKey", () => {
    const stateWithTags = {
      ...initialState,
      activeTags: new Set(["keep", "remove"]),
      activeEndpointKey: "get:/old",
    }
    const state = reducer(stateWithTags, {
      type: "SET_ROUTES",
      routes: [{ method: "get", path: "/new" }] as never[],
      allTags: [{ name: "keep", count: 1 }],
      modelRouteMap: { modelToRoutes: {}, routeToModels: {} },
    })
    expect([...state.activeTags]).toEqual(["keep"])
    expect(state.activeEndpointKey).toBe("")
    expect(state.selectedRoutes.size).toBe(0)
  })

  it("APPLY_URL_STATE applies all url state fields", () => {
    const urlState = {
      mainView: "models" as const,
      filter: "test",
      activeTags: new Set(["tag1"]),
      activeEndpointKey: "post:/api",
      endpointDetailTab: "try" as const,
      modelFilter: "user",
      modelViewMode: "graph" as const,
      activeModelName: "User",
      schemaFilter: "schema",
      schemaCategoryFilter: "category",
      schemaTypeFilter: "type",
      activeSchemaName: "MySchema",
      schemaSource: "external" as const,
    }
    const state = reducer(initialState, { type: "APPLY_URL_STATE", urlState })
    expect(state.mainView).toBe("models")
    expect(state.filter).toBe("test")
    expect(state.activeTags).toEqual(new Set(["tag1"]))
    expect(state.modelViewMode).toBe("graph")
    expect(state.schemaSource).toBe("external")
  })
})
