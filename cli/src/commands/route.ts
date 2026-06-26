import { parseArgs } from "node:util"
import { SpecStore } from "../core/spec-store"
import { loadConfig } from "../core/config"
import { formatSchema } from "@/lib/openapi/format-schema"
import { getTypeStr } from "@/lib/openapi/type-str"

function fatal(msg: string): never {
  console.error(`\x1b[31merror:\x1b[0m ${msg}`)
  process.exit(1)
}

async function loadSpec(specPath: string | undefined): Promise<ReturnType<SpecStore["load"]> extends Promise<infer T> ? T : never> {
  const store = new SpecStore()
  if (specPath) return store.load(specPath)
  const cfg = loadConfig()
  if (cfg?.config.defaultSpec) return store.load(cfg.config.defaultSpec, cfg.configDir)
  fatal("No spec provided. Use --spec <path> or set defaultSpec in apilot.config.json.")
}

export async function run(args: string[]): Promise<void> {
  const sub = args[0]
  if (sub === "list") return listRoutes(args.slice(1))
  if (sub === "show") return showRoute(args.slice(1))

  console.log(`Usage:
  apilot route list [--spec <path>] [--tag <t>] [--method <m>] [--search <s>]
  apilot route show [--spec <path>] --method <m> --path <p>`)
}

async function listRoutes(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      spec: { type: "string", short: "s" },
      tag: { type: "string", short: "t" },
      method: { type: "string", short: "m" },
      search: { type: "string" },
    },
    strict: false,
  })

  const loaded = await loadSpec(values.spec as string | undefined)
  let routes = loaded.routes

  if (values.tag) {
    const tag = (values.tag as string).toLowerCase()
    routes = routes.filter(r => r.tags.some(t => t.toLowerCase().includes(tag)))
  }
  if (values.method) {
    const method = (values.method as string).toLowerCase()
    routes = routes.filter(r => r.method.toLowerCase() === method)
  }
  if (values.search) {
    const search = (values.search as string).toLowerCase()
    routes = routes.filter(r =>
      r.path.toLowerCase().includes(search) ||
      r.summary.toLowerCase().includes(search) ||
      r.operationId.toLowerCase().includes(search))
  }

  if (routes.length === 0) {
    console.log("No routes found.")
    return
  }

  const methodWidth = Math.max(...routes.map(r => r.method.length))
  const pathWidth = Math.max(...routes.map(r => r.path.length))

  for (const r of routes) {
    const method = r.method.toUpperCase().padEnd(methodWidth + 1)
    const path = r.path.padEnd(pathWidth + 1)
    const tags = r.tags.length > 0 ? `[${r.tags.join(", ")}]` : ""
    console.log(`${method} ${path} ${r.summary}  ${tags}`)
  }
}

async function showRoute(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      spec: { type: "string", short: "s" },
      method: { type: "string", short: "m" },
      path: { type: "string", short: "p" },
    },
    strict: false,
  })

  if (!values.method || !values.path) {
    fatal("--method and --path are required. Example: apilot route show --method GET --path /api/users")
  }

  const loaded = await loadSpec(values.spec as string | undefined)
  const method = (values.method as string).toLowerCase()
  const path = values.path as string
  const route = loaded.routes.find(r => r.method.toLowerCase() === method && r.path === path)

  if (!route) {
    fatal(`Route not found: ${(values.method as string).toUpperCase()} ${path}`)
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
      if (media.schema) {
        lines.push(formatSchema(media.schema, 2))
      }
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
        if (media.schema) {
          lines.push(formatSchema(media.schema, 3))
        }
      }
    }
  }

  console.log(lines.join("\n"))
}
