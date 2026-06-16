import { describe, expect, it } from "vitest"
import { diffOpenAPISpecs } from "@/lib/openapi/diff"
import type { OpenAPISpec, PathItem } from "@/lib/openapi/types"

function makeSpec(paths: Record<string, PathItem>): OpenAPISpec {
  return {
    openapi: "3.1.0",
    info: { title: "Diff Test", version: "1.0.0" },
    paths,
  }
}

describe("openapi diff", () => {
  it("summarizes added and removed endpoints from api-smart-diff", () => {
    const before = makeSpec({
      "/users": {
        get: {
          responses: {
            "200": { description: "ok" },
          },
        },
      },
    })
    const after = makeSpec({
      "/projects": {
        post: {
          responses: {
            "201": { description: "created" },
          },
        },
      },
    })

    const result = diffOpenAPISpecs(before, after)

    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "endpoint-removed", operation: "GET /users" }),
      expect.objectContaining({ kind: "endpoint-added", operation: "POST /projects" }),
    ]))
    expect(result.byKind["endpoint-added"]).toBe(1)
    expect(result.byKind["endpoint-removed"]).toBe(1)
    expect(result.counts.breaking + result.counts.changed + result.counts["non-breaking"]).toBe(result.changes.length)
  })

  it("classifies request and response schema changes", () => {
    const before = makeSpec({
      "/users": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { id: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    })
    const after = makeSpec({
      "/users": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      status: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const kinds = diffOpenAPISpecs(before, after).changes.map(change => change.kind)

    expect(kinds).toContain("request-schema-changed")
    expect(kinds).toContain("response-schema-changed")
  })

  it("returns zero changes for identical specs", () => {
    const spec = makeSpec({
      "/users": {
        get: { responses: { "200": { description: "ok" } } },
      },
    })
    const result = diffOpenAPISpecs(spec, spec)
    expect(result.changes).toHaveLength(0)
    expect(result.counts).toEqual({ breaking: 0, changed: 0, "non-breaking": 0 })
    expect(result.byKind).toEqual({
      "endpoint-added": 0,
      "endpoint-removed": 0,
      "request-schema-changed": 0,
      "response-schema-changed": 0,
    })
  })

  it("detects parameter changes as request-schema-changed", () => {
    const before = makeSpec({
      "/users": {
        get: {
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    })
    const after = makeSpec({
      "/users": {
        get: {
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    })
    const result = diffOpenAPISpecs(before, after)
    const kinds = result.changes.map(c => c.kind)
    expect(kinds).toContain("request-schema-changed")
  })

  it("handles multiple endpoints with mixed changes", () => {
    const before = makeSpec({
      "/users": {
        get: { responses: { "200": { description: "ok" } } },
        post: {
          requestBody: {
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: { "201": { description: "created" } },
        },
      },
      "/old": {
        delete: { responses: { "204": { description: "deleted" } } },
      },
    })
    const after = makeSpec({
      "/users": {
        get: { responses: { "200": { description: "ok" } } },
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: { "201": { description: "created" } },
        },
      },
      "/new": {
        put: { responses: { "200": { description: "updated" } } },
      },
    })
    const result = diffOpenAPISpecs(before, after)
    const kinds = new Set(result.changes.map(c => c.kind))
    expect(kinds).toContain("endpoint-removed")
    expect(kinds).toContain("endpoint-added")
    expect(kinds).toContain("request-schema-changed")
  })

  it("classifies response field type change", () => {
    const before = makeSpec({
      "/items": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { count: { type: "integer" } },
                  },
                },
              },
            },
          },
        },
      },
    })
    const after = makeSpec({
      "/items": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { count: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    })
    const result = diffOpenAPISpecs(before, after)
    expect(result.changes.map(c => c.kind)).toContain("response-schema-changed")
  })

  it("severity counts sum to total changes", () => {
    const before = makeSpec({
      "/a": { get: { responses: { "200": { description: "ok" } } } },
    })
    const after = makeSpec({
      "/a": { get: { responses: { "200": { description: "ok" } } } },
      "/b": { post: { responses: { "201": { description: "created" } } } },
    })
    const result = diffOpenAPISpecs(before, after)
    const sum = result.counts.breaking + result.counts.changed + result.counts["non-breaking"]
    expect(sum).toBe(result.changes.length)
  })

  it("each change has a unique id", () => {
    const before = makeSpec({
      "/users": { get: { responses: { "200": { description: "ok" } } } },
    })
    const after = makeSpec({
      "/users": { post: { responses: { "201": { description: "created" } } } },
      "/projects": { get: { responses: { "200": { description: "ok" } } } },
    })
    const result = diffOpenAPISpecs(before, after)
    const ids = result.changes.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("each change has required fields", () => {
    const before = makeSpec({
      "/users": { get: { responses: { "200": { description: "ok" } } } },
    })
    const after = makeSpec({
      "/projects": { get: { responses: { "200": { description: "ok" } } } },
    })
    const result = diffOpenAPISpecs(before, after)
    for (const change of result.changes) {
      expect(change).toHaveProperty("id")
      expect(change).toHaveProperty("kind")
      expect(change).toHaveProperty("severity")
      expect(change).toHaveProperty("title")
      expect(change).toHaveProperty("message")
      expect(change).toHaveProperty("operation")
      expect(change).toHaveProperty("details")
      expect(["breaking", "changed", "non-breaking"]).toContain(change.severity)
    }
  })
})
