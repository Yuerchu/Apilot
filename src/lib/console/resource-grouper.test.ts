import { describe, expect, it } from "vitest"
import type { ParsedRoute } from "@/lib/openapi/types"
import { groupRoutes, groupResourcesByTag } from "./resource-grouper"

function makeRoute(overrides: Partial<ParsedRoute> = {}): ParsedRoute {
  return {
    method: "get",
    path: "/users",
    tags: [],
    summary: "",
    description: "",
    operationId: "",
    parameters: [],
    requestBody: null,
    responses: {},
    security: [],
    selected: false,
    referencedModels: [],
    ...overrides,
  }
}

function makeJsonResponse(schema: Record<string, unknown>) {
  return {
    "200": {
      description: "OK",
      content: { "application/json": { schema } },
    },
  }
}

describe("groupRoutes", () => {
  it("groups standard CRUD endpoints into a single resource", () => {
    const routes = [
      makeRoute({ method: "get", path: "/users", tags: ["Users"] }),
      makeRoute({ method: "post", path: "/users", tags: ["Users"] }),
      makeRoute({ method: "get", path: "/users/{id}", tags: ["Users"] }),
      makeRoute({ method: "put", path: "/users/{id}", tags: ["Users"] }),
      makeRoute({ method: "delete", path: "/users/{id}", tags: ["Users"] }),
    ]
    const resources = groupRoutes(routes)
    expect(resources).toHaveLength(1)
    const r = resources[0]!
    expect(r.name).toBe("users")
    expect(r.basePath).toBe("/users")
    expect(r.idParam).toBe("id")
    expect(r.operations.list).toBeDefined()
    expect(r.operations.create).toBeDefined()
    expect(r.operations.read).toBeDefined()
    expect(r.operations.update).toBeDefined()
    expect(r.operations.delete).toBeDefined()
    expect(r.confidence).toBeGreaterThan(0.5)
  })

  it("prefers PATCH over PUT for update", () => {
    const routes = [
      makeRoute({ method: "put", path: "/users/{id}" }),
      makeRoute({ method: "patch", path: "/users/{id}" }),
    ]
    const resources = groupRoutes(routes)
    expect(resources[0]!.operations.update?.route.method).toBe("patch")
  })

  it("detects actions on a resource", () => {
    const routes = [
      makeRoute({ method: "get", path: "/users" }),
      makeRoute({ method: "post", path: "/users/{id}/activate", summary: "Activate user" }),
    ]
    const resources = groupRoutes(routes)
    expect(resources).toHaveLength(1)
    expect(resources[0]!.operations.list).toBeDefined()
    expect(resources[0]!.actions).toHaveLength(1)
    expect(resources[0]!.actions[0]!.label).toBe("Activate user")
  })

  it("handles nested resources", () => {
    const routes = [
      makeRoute({ method: "get", path: "/users" }),
      makeRoute({ method: "get", path: "/users/{userId}/posts" }),
      makeRoute({ method: "post", path: "/users/{userId}/posts" }),
    ]
    const resources = groupRoutes(routes)
    const users = resources.find(r => r.name === "users")
    const posts = resources.find(r => r.name === "posts")
    expect(users).toBeDefined()
    expect(posts).toBeDefined()
    expect(posts!.parent).toBe("/users")
  })

  it("infers list item schema from paginated response", () => {
    const routes = [
      makeRoute({
        method: "get",
        path: "/users",
        responses: makeJsonResponse({
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } } },
            total: { type: "integer" },
          },
        }),
      }),
    ]
    const resources = groupRoutes(routes)
    expect(resources[0]!.listItemSchema).toBeDefined()
    expect(resources[0]!.listItemSchema?.properties?.id).toBeDefined()
  })

  it("infers list item schema from direct array response", () => {
    const routes = [
      makeRoute({
        method: "get",
        path: "/tags",
        responses: makeJsonResponse({
          type: "array",
          items: { type: "object", properties: { name: { type: "string" } } },
        }),
      }),
    ]
    const resources = groupRoutes(routes)
    expect(resources[0]!.listItemSchema?.properties?.name).toBeDefined()
  })

  it("infers create schema from request body", () => {
    const routes = [
      makeRoute({ method: "get", path: "/users" }),
      makeRoute({
        method: "post",
        path: "/users",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: { type: "string" } } },
            },
          },
        },
      }),
    ]
    const resources = groupRoutes(routes)
    expect(resources[0]!.createSchema?.properties?.name).toBeDefined()
  })

  it("generates hints for non-RESTful endpoints", () => {
    const routes = [
      makeRoute({ method: "post", path: "/auth/login", operationId: "login" }),
    ]
    const resources = groupRoutes(routes)
    expect(resources[0]!.hints.some(h => h.code === "non-restful-endpoint")).toBe(true)
  })

  it("generates hints for missing list endpoint", () => {
    const routes = [
      makeRoute({ method: "get", path: "/users/{id}" }),
      makeRoute({ method: "delete", path: "/users/{id}" }),
    ]
    const resources = groupRoutes(routes)
    expect(resources[0]!.hints.some(h => h.code === "missing-list-endpoint")).toBe(true)
  })

  it("attaches orphan to matching tag resource", () => {
    const routes = [
      makeRoute({ method: "get", path: "/users", tags: ["Users"] }),
      makeRoute({ method: "post", path: "/auth/login", tags: ["Users"], summary: "Login" }),
    ]
    const resources = groupRoutes(routes)
    const users = resources.find(r => r.name === "users")
    expect(users?.actions.some(a => a.label === "Login")).toBe(true)
  })

  it("handles API prefix paths", () => {
    const routes = [
      makeRoute({ method: "get", path: "/api/v1/users" }),
      makeRoute({ method: "post", path: "/api/v1/users" }),
      makeRoute({ method: "get", path: "/api/v1/users/{id}" }),
    ]
    const resources = groupRoutes(routes)
    const users = resources.find(r => r.name === "users")
    expect(users).toBeDefined()
    expect(users!.basePath).toBe("/api/v1/users")
  })

  it("uses tag as display name when available", () => {
    const routes = [
      makeRoute({ method: "get", path: "/users", tags: ["User Management"] }),
    ]
    const resources = groupRoutes(routes)
    expect(resources[0]!.displayName).toBe("User Management")
  })
})

describe("groupResourcesByTag", () => {
  it("groups resources by tag", () => {
    const resources = groupRoutes([
      makeRoute({ method: "get", path: "/users", tags: ["Users"] }),
      makeRoute({ method: "get", path: "/orders", tags: ["Orders"] }),
      makeRoute({ method: "get", path: "/products", tags: ["Orders"] }),
    ])
    const groups = groupResourcesByTag(resources)
    expect(groups.length).toBeGreaterThanOrEqual(2)
    const ordersGroup = groups.find(g => g.label === "Orders")
    expect(ordersGroup?.resources.length).toBe(2)
  })

  it("puts untagged resources in Other group", () => {
    const resources = groupRoutes([
      makeRoute({ method: "get", path: "/misc" }),
    ])
    const groups = groupResourcesByTag(resources)
    expect(groups[groups.length - 1]!.label).toBe("Other")
  })
})
