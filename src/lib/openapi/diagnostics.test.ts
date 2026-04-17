import { describe, expect, it } from "vitest"
import { runOpenAPIDiagnostics } from "@/lib/openapi/diagnostics"
import type { OpenAPISpec } from "@/lib/openapi/types"

describe("openapi diagnostics", () => {
  it("reports supplemental schema issues and metrics", async () => {
    const spec: OpenAPISpec = {
      openapi: "3.1.0",
      info: { title: "Diagnostics", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            operationId: "listUsers",
            responses: {
              "200": { description: "ok" },
              "204": { description: "empty" },
            },
          },
        },
      },
      components: {
        schemas: {
          Empty: {},
          Color: { type: "string", enum: ["red", "blue"] },
          User: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
    }

    const result = await runOpenAPIDiagnostics(spec)

    expect(result.metrics).toEqual({ endpointCount: 1, schemaCount: 3 })
    expect(result.byCode["empty-schema"]).toBeGreaterThan(0)
    expect(result.byCode["missing-response-schema"]).toBe(1)
    expect(result.byCode["enum-missing-description"]).toBe(1)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "empty-schema", model: "Empty" }),
      expect.objectContaining({ code: "missing-response-schema", operation: "GET /users" }),
      expect.objectContaining({ code: "enum-missing-description", model: "Color" }),
    ]))
  })

  it("maps Redocly duplicate operationId diagnostics", async () => {
    const spec: OpenAPISpec = {
      openapi: "3.1.0",
      info: { title: "Diagnostics", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            operationId: "same",
            description: "List users",
            responses: { "204": { description: "ok" } },
          },
        },
        "/projects": {
          get: {
            operationId: "same",
            description: "List projects",
            responses: { "204": { description: "ok" } },
          },
        },
      },
    }

    const result = await runOpenAPIDiagnostics(spec)

    expect(result.byCode["duplicate-operation-id"]).toBeGreaterThan(0)
    expect(result.issues.some(issue => issue.code === "duplicate-operation-id" && issue.severity === "error")).toBe(true)
  })
})
