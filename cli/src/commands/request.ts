import { parseArgs } from "node:util"
import { SpecStore } from "../core/spec-store"
import { loadConfig } from "../core/config"
import { resolveEnvironment } from "../core/env-utils"
import { sendRequest } from "../core/send-request"

function fatal(msg: string): never {
  console.error(`\x1b[31merror:\x1b[0m ${msg}`)
  process.exit(1)
}

export async function run(args: string[]): Promise<void> {
  const sub = args[0]
  if (sub === "send") return sendReq(args.slice(1))

  console.log(`Usage:
  apilot request send [--spec <path>] --env <name> --method <m> --path <p> [--body <json>] [--content-type <ct>] [--params <json>]`)
}

async function sendReq(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      spec: { type: "string", short: "s" },
      env: { type: "string", short: "e" },
      method: { type: "string", short: "m" },
      path: { type: "string", short: "p" },
      body: { type: "string", short: "b" },
      "content-type": { type: "string" },
      params: { type: "string" },
    },
    strict: false,
  })

  if (!values.method || !values.path) {
    fatal("--method and --path are required.")
  }
  if (!values.env) {
    fatal("--env is required. Run 'apilot env list' to see available environments.")
  }

  const cfgResult = loadConfig()
  if (!cfgResult) {
    fatal("No apilot.config.json found. Run 'apilot env add' to create one.")
  }

  const resolved = resolveEnvironment(cfgResult.config, values.env as string)

  const store = new SpecStore()
  let loaded
  if (values.spec) {
    loaded = await store.load(values.spec as string)
  } else if (cfgResult.config.defaultSpec) {
    loaded = await store.load(cfgResult.config.defaultSpec, cfgResult.configDir)
  } else {
    fatal("No spec provided. Use --spec <path> or set defaultSpec in apilot.config.json.")
  }

  const method = (values.method as string).toLowerCase()
  const path = values.path as string
  const route = loaded.routes.find(r => r.method.toLowerCase() === method && r.path === path)

  if (!route) {
    fatal(`Route not found: ${(values.method as string).toUpperCase()} ${path}`)
  }

  let params: Record<string, string> = {}
  if (values.params) {
    try {
      params = JSON.parse(values.params as string)
    } catch {
      fatal("Invalid --params JSON.")
    }
  }

  const result = await sendRequest(route, {
    baseUrl: resolved.baseUrl,
    params,
    ...(values.body ? { body: values.body as string } : {}),
    ...(values["content-type"] ? { contentType: values["content-type"] as string } : {}),
    headers: resolved.headers,
    envVars: resolved.variables,
  })

  const lines: string[] = []
  lines.push(`HTTP ${result.status} ${result.statusText} (${result.elapsed}ms)`)
  lines.push("")

  if (Object.keys(result.headers).length > 0) {
    lines.push("Response Headers:")
    for (const [k, v] of Object.entries(result.headers)) {
      lines.push(`  ${k}: ${v}`)
    }
    lines.push("")
  }

  if (result.body) {
    lines.push("Response Body:")
    lines.push(result.body)
  }

  console.log(lines.join("\n"))
}
