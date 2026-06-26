import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"

export interface AuthConfig {
  type: "none" | "bearer" | "basic" | "apikey"
  token?: string
  username?: string
  keyName?: string
}

export interface EnvironmentConfig {
  baseUrl: string
  stage?: "local" | "development" | "testing" | "staging" | "production"
  auth?: AuthConfig
  variables?: Record<string, string>
}

export interface ApilotConfig {
  version: 1
  defaultSpec?: string
  environments: Record<string, EnvironmentConfig>
}

const CONFIG_FILENAME = "apilot.config.json"

export function resolveConfigValue(value: string): string {
  return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const envVal = process.env[key]
    return envVal !== undefined ? envVal : match
  })
}

export function findConfigPath(startDir?: string): string | null {
  let dir = startDir ? resolve(startDir) : process.cwd()
  while (true) {
    const candidate = resolve(dir, CONFIG_FILENAME)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function loadConfig(startDir?: string): { config: ApilotConfig; configDir: string } | null {
  const configPath = findConfigPath(startDir)
  if (!configPath) return null
  const raw = readFileSync(configPath, "utf8")
  const config = JSON.parse(raw) as ApilotConfig
  return { config, configDir: dirname(configPath) }
}

export function saveConfig(config: ApilotConfig, dir?: string): void {
  const targetDir = dir ? resolve(dir) : process.cwd()
  const configPath = resolve(targetDir, CONFIG_FILENAME)
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8")
}

export function getDefaultConfig(): ApilotConfig {
  return { version: 1, environments: {} }
}
