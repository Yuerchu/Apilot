import { describe, expect, it } from "vitest"
import {
  buildModelRouteMap,
  collectModelRefs,
  convertSwaggerV2,
  getOperationKey,
  parseSpecText,
  resolveServerUrl,
} from "@/lib/openapi/parser"
import type { OpenAPISpec, ParsedRoute } from "@/lib/openapi/types"

describe("openapi parser helpers", () => {
  it("parses JSON and YAML spec text", () => {
    expect(parseSpecText('{ "openapi": "3.1.0", "info": { "title": "JSON" }, "paths": {} }')).toMatchObject({
      openapi: "3.1.0",
      info: { title: "JSON" },
    })

    expect(parseSpecText("openapi: 3.1.0\ninfo:\n  title: YAML\npaths: {}\n")).toMatchObject({
      openapi: "3.1.0",
      info: { title: "YAML" },
    })
  })

  it("resolves server variables with defaults", () => {
    expect(resolveServerUrl({
      url: "https://{tenant}.example.com/{version}",
      variables: {
        tenant: { default: "api" },
        version: { default: "v1" },
      },
    })).toBe("https://api.example.com/v1")
  })

  it("converts Swagger 2 body params, response schemas, definitions, and security schemes", () => {
    const swagger: OpenAPISpec = {
      swagger: "2.0",
      info: { title: "Swagger", version: "1.0.0" },
      host: "api.example.com",
      basePath: "/v1/",
      schemes: ["https"],
      consumes: ["application/json"],
      produces: ["application/json"],
      definitions: {
        Role: { type: "string", enum: ["admin"] },
        User: {
          type: "object",
          properties: {
            role: { $ref: "#/definitions/Role" },
          },
        },
      },
      securityDefinitions: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "X-Api-Key" },
      },
      paths: {
        "/users": {
          post: {
            parameters: [
              {
                name: "body",
                in: "body",
                required: true,
                schema: { $ref: "#/definitions/User" },
              },
            ],
            responses: {
              "200": {
                description: "ok",
                schema: { $ref: "#/definitions/User" },
              },
            },
          },
        },
      },
    }

    const converted = convertSwaggerV2(swagger)
    const operation = converted.paths?.["/users"]?.post
    const userSchema = converted.components?.schemas?.User
    const roleProperty = userSchema?.properties?.role

    expect(converted.servers?.[0]?.url).toBe("https://api.example.com/v1")
    expect(converted.components?.securitySchemes?.ApiKeyAuth).toEqual(swagger.securityDefinitions?.ApiKeyAuth)
    expect(roleProperty?.$ref).toBe("#/components/schemas/Role")
    expect(operation?.parameters).toEqual([])
    expect(operation?.requestBody?.required).toBe(true)
    expect(operation?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe("#/components/schemas/User")
    expect(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref).toBe("#/components/schemas/User")
  })

  it("converts Swagger 2 form data params into request body schema", () => {
    const converted = convertSwaggerV2({
      swagger: "2.0",
      info: { title: "Forms", version: "1.0.0" },
      paths: {
        "/upload": {
          post: {
            consumes: ["multipart/form-data"],
            parameters: [
              { name: "file", in: "formData", type: "file", required: true },
              { name: "title", in: "formData", type: "string" },
            ],
            responses: { "204": { description: "uploaded" } },
          },
        },
      },
    })

    const schema = converted.paths?.["/upload"]?.post?.requestBody?.content?.["multipart/form-data"]?.schema
    expect(schema).toMatchObject({
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
        title: { type: "string" },
      },
    })
  })

  it("collects model refs and builds route-model indexes", () => {
    const found = new Set<string>()
    collectModelRefs({
      request: { $ref: "#/definitions/User" },
      response: { items: [{ $ref: "#/components/schemas/Project" }] },
    }, found)

    expect([...found].sort()).toEqual(["Project", "User"])

    const routes: ParsedRoute[] = [
      { method: "get", path: "/users", tags: [], summary: "", description: "", operationId: "", parameters: [], requestBody: null, responses: {}, security: [], selected: false, referencedModels: ["User"] },
      { method: "post", path: "/projects", tags: [], summary: "", description: "", operationId: "", parameters: [], requestBody: null, responses: {}, security: [], selected: false, referencedModels: ["Project", "User"] },
    ]
    expect(buildModelRouteMap(routes)).toEqual({
      modelToRoutes: { User: [0, 1], Project: [1] },
      routeToModels: { 0: ["User"], 1: ["Project", "User"] },
    })
    expect(getOperationKey("get", "/users")).toBe("GET /users")
  })
})
