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
})
