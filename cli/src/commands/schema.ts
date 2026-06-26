import { parseArgs } from "node:util"
import { SpecStore } from "../core/spec-store"
import { loadConfig } from "../core/config"
import { formatSchema } from "@/lib/openapi/format-schema"

function fatal(msg: string): never {
  console.error(`\x1b[31merror:\x1b[0m ${msg}`)
  process.exit(1)
}

export async function run(args: string[]): Promise<void> {
  const sub = args[0]
  if (sub === "show") return showSchema(args.slice(1))

  console.log(`Usage:
  apilot schema show [--spec <path>] --name <name>`)
}

async function showSchema(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      spec: { type: "string", short: "s" },
      name: { type: "string", short: "n" },
    },
    strict: false,
  })

  if (!values.name) {
    fatal("--name is required. Example: apilot schema show --name User")
  }

  const store = new SpecStore()
  let loaded
  if (values.spec) {
    loaded = await store.load(values.spec as string)
  } else {
    const cfg = loadConfig()
    if (cfg?.config.defaultSpec) {
      loaded = await store.load(cfg.config.defaultSpec, cfg.configDir)
    } else {
      fatal("No spec provided. Use --spec <path> or set defaultSpec in apilot.config.json.")
    }
  }

  const schemas = loaded.spec.components?.schemas || loaded.spec.definitions || {}
  const name = values.name as string
  const schema = schemas[name]

  if (!schema) {
    const available = Object.keys(schemas).slice(0, 20).join(", ")
    const more = Object.keys(schemas).length > 20 ? ` (and ${Object.keys(schemas).length - 20} more)` : ""
    fatal(`Schema "${name}" not found. Available: ${available}${more}`)
  }

  console.log(`${name}:`)
  console.log(formatSchema(schema, 1))
}
