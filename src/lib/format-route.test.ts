import { describe, expect, it } from "vitest"
import { formatMarkdown } from "@/lib/format-route"
import type { ParsedRoute } from "@/lib/openapi/types"

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

describe("formatMarkdown", () => {
  it("includes method and path as heading", () => {
    const md = formatMarkdown(makeRoute())
    expect(md).toContain("## GET /users")
  })

  it("includes summary and description", () => {
    const md = formatMarkdown(makeRoute({
      summary: "List all users",
      description: "Returns a paginated list of users",
    }))
    expect(md).toContain("List all users")
    expect(md).toContain("Returns a paginated list of users")
  })

  it("does not duplicate description when same as summary", () => {
    const md = formatMarkdown(makeRoute({
      summary: "List users",
      description: "List users",
    }))
    const matches = md.match(/List users/g)
    expect(matches).toHaveLength(1)
  })

  it("includes operationId", () => {
    const md = formatMarkdown(makeRoute({ operationId: "listUsers" }))
    expect(md).toContain("listUsers")
  })

  it("formats parameters with type and location", () => {
    const md = formatMarkdown(makeRoute({
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "User ID" },
        { name: "page", in: "query", required: false, schema: { type: "integer" } },
      ],
    }))
    expect(md).toContain("### Parameters")
    expect(md).toContain("id (required)")
    expect(md).toContain("in: path")
    expect(md).toContain("User ID")
    expect(md).toContain("page:")
    expect(md).toContain("in: query")
  })

  it("formats parameter enums and defaults", () => {
    const md = formatMarkdown(makeRoute({
      parameters: [
        { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["asc", "desc"], default: "asc" } },
      ],
    }))
    expect(md).toContain("enum: [asc, desc]")
    expect(md).toContain('default: "asc"')
  })

  it("formats request body section", () => {
    const md = formatMarkdown(makeRoute({
      requestBody: {
        required: true,
        description: "User data",
        content: {
          "application/json": {
            schema: { type: "object", properties: { name: { type: "string" } } },
          },
        },
      },
    }))
    expect(md).toContain("### Request Body (required)")
    expect(md).toContain("User data")
    expect(md).toContain("Content-Type: application/json")
  })

  it("formats responses", () => {
    const md = formatMarkdown(makeRoute({
      responses: {
        "200": {
          description: "Success",
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        "404": { description: "Not found", content: {} },
      },
    }))
    expect(md).toContain("### Responses")
    expect(md).toContain("#### 200: Success")
    expect(md).toContain("#### 404: Not found")
  })

  it("includes examples when requested", () => {
    const md = formatMarkdown(makeRoute({
      responses: {
        "200": {
          description: "ok",
          content: {
            "application/json": {
              schema: { type: "object", properties: { id: { type: "integer" } } },
              example: { id: 42 },
            },
          },
        },
      },
    }), true)
    expect(md).toContain("Example:")
    expect(md).toContain("42")
  })
})
