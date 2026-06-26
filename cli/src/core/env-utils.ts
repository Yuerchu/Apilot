import { buildAuthHeaders } from "@/lib/request-utils"
import type { ApilotConfig, EnvironmentConfig } from "./config"
import { resolveConfigValue } from "./config"

export interface ResolvedEnvironment {
  name: string
  baseUrl: string
  headers: Record<string, string>
  variables: Record<string, string>
}

export function resolveEnvironment(config: ApilotConfig, envName: string): ResolvedEnvironment {
  const env = config.environments[envName]
  if (!env) {
    throw new Error(`Environment "${envName}" not found. Available: ${Object.keys(config.environments).join(", ") || "(none)"}`)
  }
  return resolveEnvironmentConfig(envName, env)
}

export function resolveEnvironmentConfig(name: string, env: EnvironmentConfig): ResolvedEnvironment {
  const baseUrl = resolveConfigValue(env.baseUrl).replace(/\/$/, "")
  const auth = env.auth
  let headers: Record<string, string> = {}
  if (auth && auth.type !== "none") {
    const token = auth.token ? resolveConfigValue(auth.token) : ""
    const username = auth.username ? resolveConfigValue(auth.username) : ""
    const keyName = auth.keyName || "X-API-Key"
    headers = buildAuthHeaders(auth.type, token, username, keyName, null)
  }

  const variables: Record<string, string> = {}
  if (env.variables) {
    for (const [k, v] of Object.entries(env.variables)) {
      variables[k] = resolveConfigValue(v)
    }
  }

  return { name, baseUrl, headers, variables }
}

export function interpolateEnvVars(text: string, vars: Record<string, string>): string {
  const isJson = text.trimStart().startsWith("{") || text.trimStart().startsWith("[")
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = vars[key]
    if (val === undefined) return match
    if (isJson) return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    return val
  })
}
