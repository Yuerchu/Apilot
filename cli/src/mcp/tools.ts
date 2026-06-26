import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { SpecStore, LoadedSpec } from "../core/spec-store"
import type { ApilotConfig } from "../core/config"
import { resolveEnvironment } from "../core/env-utils"
import { sendRequest } from "../core/send-request"
import { formatSchema } from "@/lib/openapi/format-schema"
import { getTypeStr } from "@/lib/openapi/type-str"

function resolveSpec(specStore: SpecStore, specId?: string): LoadedSpec {
  if (specId) {
    const spec = specStore.get(specId)
    if (!spec) throw new Error(`Spec "${specId}" not loaded. Call apilot_spec_load first.`)
    return spec
  }
  const only = specStore.getOnly()
  if (only) return only
  const list = specStore.list()
  if (list.length === 0) throw new Error("No spec loaded. Call apilot_spec_load first.")
  throw new Error(`Multiple specs loaded. Specify specId. Available: ${list.map(s => s.id).join(", ")}`)
}

export function registerTools(
  server: McpServer,
  specStore: SpecStore,
  cfgResult: { config: ApilotConfig; configDir: string } | null,
): void {

  server.tool(
    "apilot_spec_load",
    "Load an OpenAPI/Swagger spec from a file path or URL into memory for querying",
    { source: z.string().describe("File path or HTTP(S) URL to the spec") },
    async ({ source }) => {
      const loaded = await specStore.load(source, cfgResult?.configDir)
      const tags = loaded.allTags.map(t => t.name).join(", ")
      return {
        content: [{
          type: "text" as const,
          text: [
            `Spec loaded: ${loaded.title} v${loaded.version}`,
            `ID: ${loaded.id}`,
            `Routes: ${loaded.routes.length}`,
            `Tags: ${tags || "(none)"}`,
          ].join("\n"),
        }],
      }
    },
  )

  server.tool(
    "apilot_route_list",
    "List API endpoints from the loaded spec. Supports filtering by tag, method, or path keyword. Returns a compact table.",
    {
      specId: z.string().optional().describe("Spec ID from apilot_spec_load (optional if only one spec loaded)"),
      tag: z.string().optional().describe("Filter by tag name (case-insensitive substring)"),
      method: z.string().optional().describe("Filter by HTTP method (GET, POST, etc.)"),
      search: z.string().optional().describe("Filter by keyword in path, summary, or operationId"),
    },
    async ({ specId, tag, method, search }) => {
      const loaded = resolveSpec(specStore, specId)
      let routes = loaded.routes

      if (tag) {
        const t = tag.toLowerCase()
        routes = routes.filter(r => r.tags.some(rt => rt.toLowerCase().includes(t)))
      }
      if (method) {
        const m = method.toLowerCase()
        routes = routes.filter(r => r.method.toLowerCase() === m)
      }
      if (search) {
        const s = search.toLowerCase()
        routes = routes.filter(r =>
          r.path.toLowerCase().includes(s) ||
          r.summary.toLowerCase().includes(s) ||
          r.operationId.toLowerCase().includes(s))
      }

      if (routes.length === 0) {
        return { content: [{ type: "text" as const, text: "No routes match the filter." }] }
      }

      const methodW = Math.max(...routes.map(r => r.method.length))
      const pathW = Math.max(...routes.map(r => r.path.length))
      const lines = routes.map(r => {
        const m = r.method.toUpperCase().padEnd(methodW + 1)
        const p = r.path.padEnd(pathW + 1)
        const tags = r.tags.length ? `[${r.tags.join(", ")}]` : ""
        return `${m} ${p} ${r.summary}  ${tags}`
      })

      return { content: [{ type: "text" as const, text: lines.join("\n") }] }
    },
  )

  server.tool(
    "apilot_route_show",
    "Show full details of a specific API endpoint: parameters, request body schema, response schemas, and security requirements",
    {
      specId: z.string().optional().describe("Spec ID (optional if only one spec loaded)"),
      method: z.string().describe("HTTP method (GET, POST, etc.)"),
      path: z.string().describe("Endpoint path (e.g. /api/v1/config)"),
    },
    async ({ specId, method, path }) => {
      const loaded = resolveSpec(specStore, specId)
      const m = method.toLowerCase()
      const route = loaded.routes.find(r => r.method.toLowerCase() === m && r.path === path)

      if (!route) {
        return { content: [{ type: "text" as const, text: `Route not found: ${method.toUpperCase()} ${path}` }], isError: true }
      }

      const lines: string[] = []
      lines.push(`${route.method.toUpperCase()} ${route.path}`)
      if (route.summary) lines.push(`Summary: ${route.summary}`)
      if (route.description) lines.push(`Description: ${route.description}`)
      if (route.operationId) lines.push(`Operation ID: ${route.operationId}`)
      if (route.tags.length) lines.push(`Tags: ${route.tags.join(", ")}`)

      if (route.parameters.length > 0) {
        lines.push("")
        lines.push("Parameters:")
        for (const p of route.parameters) {
          const req = p.required ? ", required" : ""
          const type = p.schema ? getTypeStr(p.schema) : p.type || "string"
          const desc = p.description ? ` — ${p.description}` : ""
          lines.push(`  ${p.name} (${p.in}${req}): ${type}${desc}`)
        }
      }

      if (route.requestBody) {
        lines.push("")
        lines.push("Request Body:")
        const content = route.requestBody.content || {}
        for (const [ct, media] of Object.entries(content)) {
          lines.push(`  Content-Type: ${ct}`)
          if (media.schema) lines.push(formatSchema(media.schema, 2))
        }
      }

      if (route.responses && Object.keys(route.responses).length > 0) {
        lines.push("")
        lines.push("Responses:")
        for (const [status, resp] of Object.entries(route.responses)) {
          const desc = resp.description ? ` — ${resp.description}` : ""
          lines.push(`  ${status}${desc}:`)
          const content = resp.content || {}
          for (const [ct, media] of Object.entries(content)) {
            if (Object.keys(content).length > 1) lines.push(`    Content-Type: ${ct}`)
            if (media.schema) lines.push(formatSchema(media.schema, 3))
          }
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] }
    },
  )

  server.tool(
    "apilot_schema_show",
    "Show the full schema definition of a named model from components/schemas",
    {
      specId: z.string().optional().describe("Spec ID (optional if only one spec loaded)"),
      name: z.string().describe("Schema name (e.g. ConfigItem)"),
    },
    async ({ specId, name }) => {
      const loaded = resolveSpec(specStore, specId)
      const schemas = loaded.spec.components?.schemas || loaded.spec.definitions || {}
      const schema = schemas[name]

      if (!schema) {
        const available = Object.keys(schemas).slice(0, 30).join(", ")
        return {
          content: [{ type: "text" as const, text: `Schema "${name}" not found. Available: ${available}` }],
          isError: true,
        }
      }

      return { content: [{ type: "text" as const, text: `${name}:\n${formatSchema(schema, 1)}` }] }
    },
  )

  server.tool(
    "apilot_request_send",
    "Send an HTTP request to an API endpoint. Requires environment name for base URL and auth.",
    {
      specId: z.string().optional().describe("Spec ID (optional if only one spec loaded)"),
      method: z.string().describe("HTTP method"),
      path: z.string().describe("Endpoint path"),
      env: z.string().describe("Environment name from apilot.config.json"),
      params: z.record(z.string()).optional().describe("Path/query/header parameters as key-value pairs"),
      body: z.string().optional().describe("Request body (JSON string)"),
      contentType: z.string().optional().describe("Content-Type header (default: application/json)"),
    },
    async ({ specId, method, path, env, params, body, contentType }) => {
      if (!cfgResult) {
        return { content: [{ type: "text" as const, text: "No apilot.config.json found. Create one with env config first." }], isError: true }
      }

      let resolved
      try {
        resolved = resolveEnvironment(cfgResult.config, env)
      } catch (e) {
        return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true }
      }

      const loaded = resolveSpec(specStore, specId)
      const m = method.toLowerCase()
      const route = loaded.routes.find(r => r.method.toLowerCase() === m && r.path === path)

      if (!route) {
        return { content: [{ type: "text" as const, text: `Route not found: ${method.toUpperCase()} ${path}` }], isError: true }
      }

      const result = await sendRequest(route, {
        baseUrl: resolved.baseUrl,
        params: params || {},
        body,
        contentType,
        headers: resolved.headers,
        envVars: resolved.variables,
      })

      const lines: string[] = []
      lines.push(`HTTP ${result.status} ${result.statusText} (${result.elapsed}ms)`)

      if (Object.keys(result.headers).length > 0) {
        lines.push("")
        lines.push("Response Headers:")
        for (const [k, v] of Object.entries(result.headers)) {
          lines.push(`  ${k}: ${v}`)
        }
      }

      if (result.body) {
        lines.push("")
        lines.push("Response Body:")
        lines.push(result.body)
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] }
    },
  )

  server.tool(
    "apilot_env_list",
    "List all configured environments (name, base URL, stage) from apilot.config.json",
    {},
    async () => {
      if (!cfgResult) {
        return { content: [{ type: "text" as const, text: "No apilot.config.json found." }] }
      }

      const envs = cfgResult.config.environments
      const names = Object.keys(envs)
      if (names.length === 0) {
        return { content: [{ type: "text" as const, text: "No environments configured." }] }
      }

      const nameW = Math.max(...names.map(n => n.length), 4)
      const urlW = Math.max(...names.map(n => envs[n].baseUrl.length), 3)
      const lines = names.map(name => {
        const env = envs[name]
        const stage = env.stage || ""
        return `${name.padEnd(nameW + 1)} ${env.baseUrl.padEnd(urlW + 1)} ${stage}`
      })

      return { content: [{ type: "text" as const, text: lines.join("\n") }] }
    },
  )

  server.tool(
    "apilot_generate_example",
    "Generate an example request body for an endpoint based on its schema",
    {
      specId: z.string().optional().describe("Spec ID (optional if only one spec loaded)"),
      method: z.string().describe("HTTP method"),
      path: z.string().describe("Endpoint path"),
    },
    async ({ specId, method, path }) => {
      const loaded = resolveSpec(specStore, specId)
      const m = method.toLowerCase()
      const route = loaded.routes.find(r => r.method.toLowerCase() === m && r.path === path)

      if (!route) {
        return { content: [{ type: "text" as const, text: `Route not found: ${method.toUpperCase()} ${path}` }], isError: true }
      }

      if (!route.requestBody) {
        return { content: [{ type: "text" as const, text: "This endpoint has no request body." }] }
      }

      const content = route.requestBody.content || {}
      const media = Object.values(content)[0]
      if (!media?.schema) {
        return { content: [{ type: "text" as const, text: "No schema defined for request body." }] }
      }

      const { generateExample } = await import("@/lib/openapi/generate-example")
      const example = generateExample(media.schema)
      return { content: [{ type: "text" as const, text: JSON.stringify(example, null, 2) }] }
    },
  )
}
