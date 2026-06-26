import { parseArgs } from "node:util"
import { loadConfig, saveConfig, getDefaultConfig } from "../core/config"
import type { AuthConfig } from "../core/config"

function fatal(msg: string): never {
  console.error(`\x1b[31merror:\x1b[0m ${msg}`)
  process.exit(1)
}

export async function run(args: string[]): Promise<void> {
  const sub = args[0]
  if (sub === "list") return listEnvs()
  if (sub === "add") return addEnv(args.slice(1))
  if (sub === "remove") return removeEnv(args.slice(1))

  console.log(`Usage:
  apilot env list
  apilot env add <name> --url <base-url> [--auth-type <type>] [--auth-token <token>] [--stage <stage>]
  apilot env remove <name>`)
}

function listEnvs(): void {
  const result = loadConfig()
  if (!result) {
    console.log("No apilot.config.json found.")
    return
  }
  const envs = result.config.environments
  const names = Object.keys(envs)
  if (names.length === 0) {
    console.log("No environments configured.")
    return
  }

  const nameWidth = Math.max(...names.map(n => n.length), 4)
  const urlWidth = Math.max(...names.map(n => envs[n].baseUrl.length), 3)

  for (const name of names) {
    const env = envs[name]
    const stage = env.stage || ""
    console.log(`${name.padEnd(nameWidth + 1)} ${env.baseUrl.padEnd(urlWidth + 1)} ${stage}`)
  }
}

function addEnv(args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    options: {
      url: { type: "string" },
      "auth-type": { type: "string" },
      "auth-token": { type: "string" },
      "auth-user": { type: "string" },
      "auth-key-name": { type: "string" },
      stage: { type: "string" },
    },
    allowPositionals: true,
    strict: false,
  })

  const name = positionals[0]
  if (!name) fatal("Environment name is required. Example: apilot env add dev --url https://api.example.com")
  if (!values.url) fatal("--url is required.")

  const result = loadConfig()
  const config = result?.config || getDefaultConfig()

  if (config.environments[name]) {
    fatal(`Environment "${name}" already exists. Remove it first with 'apilot env remove ${name}'.`)
  }

  let auth: AuthConfig | undefined
  if (values["auth-type"]) {
    const authType = values["auth-type"] as string
    if (!["none", "bearer", "basic", "apikey"].includes(authType)) {
      fatal(`Invalid auth type: ${authType}. Valid: none, bearer, basic, apikey`)
    }
    auth = {
      type: authType as AuthConfig["type"],
      token: values["auth-token"] as string | undefined,
      username: values["auth-user"] as string | undefined,
      keyName: values["auth-key-name"] as string | undefined,
    }
  }

  config.environments[name] = {
    baseUrl: values.url as string,
    ...(values.stage ? { stage: values.stage as "development" } : {}),
    ...(auth ? { auth } : {}),
  }

  saveConfig(config, result?.configDir)
  console.log(`\x1b[32m✓\x1b[0m Environment "${name}" added.`)
}

function removeEnv(args: string[]): void {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
    strict: false,
  })

  const name = positionals[0]
  if (!name) fatal("Environment name is required. Example: apilot env remove dev")

  const result = loadConfig()
  if (!result) fatal("No apilot.config.json found.")

  if (!result.config.environments[name]) {
    fatal(`Environment "${name}" not found.`)
  }

  delete result.config.environments[name]
  saveConfig(result.config, result.configDir)
  console.log(`\x1b[32m✓\x1b[0m Environment "${name}" removed.`)
}
