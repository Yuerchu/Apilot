import {
  openDB,
  type IDBPDatabase,
  type IDBPObjectStore,
  type IDBPTransaction,
} from "idb"
import { computeSpecId } from "@/lib/spec-id"
import { resolveServerUrl } from "@/lib/openapi/parser"
import type { AuthType, OpenAPISpec, RequestResponse } from "@/lib/openapi/types"

export type SpecSourceType = "url" | "file" | "embedded"

export interface SpecRecord {
  id: string
  sourceType: SpecSourceType
  specUrl: string
  title: string
  version: string
  origin: string
  contentHash: string
  lastOpenedAt: number
  createdAt: number
  updatedAt: number
}

export interface SpecSettings {
  specId: string
  activeEnvId: string | null
  updatedAt: number
}

export interface HistoryEntry {
  id?: number
  specId: string
  envId: string | null
  envNameSnapshot: string | null
  routeKey: string
  method: string
  path: string
  requestParams: Record<string, string>
  requestBody: string | null
  contentType: string
  response: RequestResponse
  timestamp: number
}

export interface FavoriteEntry {
  id: string
  specId: string
  routeKey: string
  createdAt: number
}

export interface EnvVarEntry {
  id: string
  specId: string
  envId: string | null
  key: string
  value: string
}

export type EnvironmentStage = "local" | "development" | "testing" | "staging" | "production" | ""

export interface EnvironmentProfile {
  id: string
  specId: string
  name: string
  baseUrl: string
  source: "spec" | "custom"
  stage: EnvironmentStage
  specPath: string
  createdAt: number
  updatedAt: number
}

export interface EnvironmentCredential {
  envId: string
  authType: AuthType
  authToken: string
  authUser: string
  authKeyName: string
  oauth2Token: string | null
  updatedAt: number
}

export type EnvironmentRuntime = EnvironmentProfile & EnvironmentCredential

export interface WsHistoryEntry {
  id?: number
  specId: string
  envId: string | null
  envNameSnapshot: string | null
  channelId: string
  direction: "sent" | "received"
  body: string
  messageType: string
  timestamp: number
}

export interface LegacySettingsSnapshot {
  specUrl: string
  baseUrl: string
  authType: AuthType
  authToken: string
  authUser: string
  authKeyName: string
  oauth2Token: string | null
  activeEnvId: string | null
}

const DB_NAME = "apilot"
const DB_VERSION = 6
const MAX_BODY_SIZE = 100 * 1024

const LEGACY_LS_KEYS = {
  url: "oa_specUrl",
  base: "oa_baseUrl",
  authType: "oa_authType",
  authToken: "oa_authToken",
  authUser: "oa_authUser",
  authKeyName: "oa_authKeyName",
  oauth2Token: "oa_oauth2Token",
  activeEnvId: "oa_activeEnvId",
} as const

let dbPromise: Promise<IDBPDatabase> | null = null

type UpgradeStore = IDBPObjectStore<unknown, ArrayLike<string>, string, "versionchange">
type UpgradeTransaction = IDBPTransaction<unknown, string[], "versionchange">

function hasIndex(store: UpgradeStore, name: string): boolean {
  return store.indexNames.contains(name)
}

function ensureIndex(store: UpgradeStore, name: string, keyPath: string | string[]): void {
  if (!hasIndex(store, name)) store.createIndex(name, keyPath)
}

function createStoresAndIndexes(db: IDBPDatabase): void {
  const history = db.objectStoreNames.contains("history")
    ? null
    : db.createObjectStore("history", { keyPath: "id", autoIncrement: true })
  if (history) {
    history.createIndex("specId", "specId")
    history.createIndex("specId_routeKey", ["specId", "routeKey"])
    history.createIndex("timestamp", "timestamp")
  }

  const favorites = db.objectStoreNames.contains("favorites")
    ? null
    : db.createObjectStore("favorites", { keyPath: "id" })
  if (favorites) {
    favorites.createIndex("specId", "specId")
  }

  const envVars = db.objectStoreNames.contains("envVars")
    ? null
    : db.createObjectStore("envVars", { keyPath: "id" })
  if (envVars) {
    envVars.createIndex("specId", "specId")
  }

  const environments = db.objectStoreNames.contains("environments")
    ? null
    : db.createObjectStore("environments", { keyPath: "id" })
  if (environments) {
    environments.createIndex("specId", "specId")
  }

  const ws = db.objectStoreNames.contains("wsHistory")
    ? null
    : db.createObjectStore("wsHistory", { keyPath: "id", autoIncrement: true })
  if (ws) {
    ws.createIndex("specId_channelId", ["specId", "channelId"])
    ws.createIndex("timestamp", "timestamp")
  }

  const specs = db.objectStoreNames.contains("specs")
    ? null
    : db.createObjectStore("specs", { keyPath: "id" })
  if (specs) {
    specs.createIndex("lastOpenedAt", "lastOpenedAt")
    specs.createIndex("specUrl", "specUrl")
  }

  if (!db.objectStoreNames.contains("specSettings")) {
    db.createObjectStore("specSettings", { keyPath: "specId" })
  }

  const credentials = db.objectStoreNames.contains("environmentCredentials")
    ? null
    : db.createObjectStore("environmentCredentials", { keyPath: "envId" })
  if (credentials) {
    credentials.createIndex("authType", "authType")
  }
}

function ensureIndexesForExistingStores(transaction: UpgradeTransaction): void {
  for (const name of transaction.objectStoreNames) {
    const store = transaction.objectStore(name)
    if (name === "history") {
      ensureIndex(store, "specId", "specId")
      ensureIndex(store, "specId_routeKey", ["specId", "routeKey"])
      ensureIndex(store, "timestamp", "timestamp")
    }
    if (name === "favorites") {
      ensureIndex(store, "specId", "specId")
    }
    if (name === "envVars") {
      ensureIndex(store, "specId", "specId")
    }
    if (name === "environments") {
      ensureIndex(store, "specId", "specId")
    }
    if (name === "wsHistory") {
      ensureIndex(store, "specId_channelId", ["specId", "channelId"])
      ensureIndex(store, "timestamp", "timestamp")
    }
    if (name === "specs") {
      ensureIndex(store, "lastOpenedAt", "lastOpenedAt")
      ensureIndex(store, "specUrl", "specUrl")
    }
    if (name === "environmentCredentials") {
      ensureIndex(store, "authType", "authType")
    }
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function authTypeValue(value: unknown): AuthType {
  const authType = stringValue(value)
  return authType === "bearer" || authType === "basic" || authType === "apikey" || authType === "oauth2"
    ? authType
    : "none"
}

function stageValue(value: unknown): EnvironmentStage {
  const stage = stringValue(value)
  return stage === "local"
    || stage === "development"
    || stage === "testing"
    || stage === "staging"
    || stage === "production"
    ? stage
    : ""
}

export function createEmptyEnvironmentCredential(envId: string, now = Date.now()): EnvironmentCredential {
  return {
    envId,
    authType: "none",
    authToken: "",
    authUser: "",
    authKeyName: "",
    oauth2Token: null,
    updatedAt: now,
  }
}

export function credentialFromLegacyEnvironment(record: Record<string, unknown>, now = Date.now()): EnvironmentCredential {
  const envId = stringValue(record.id)
  return {
    envId,
    authType: authTypeValue(record.authType),
    authToken: stringValue(record.authToken),
    authUser: stringValue(record.authUser),
    authKeyName: stringValue(record.authKeyName),
    oauth2Token: typeof record.oauth2Token === "string" && record.oauth2Token.length > 0
      ? record.oauth2Token
      : null,
    updatedAt: numberValue(record.updatedAt, now),
  }
}

export function profileFromLegacyEnvironment(record: Record<string, unknown>, now = Date.now()): EnvironmentProfile {
  const id = stringValue(record.id) || crypto.randomUUID()
  return {
    id,
    specId: stringValue(record.specId),
    name: stringValue(record.name) || "Default",
    baseUrl: stringValue(record.baseUrl),
    source: record.source === "spec" ? "spec" : "custom",
    stage: stageValue(record.stage),
    specPath: stringValue(record.specPath),
    createdAt: numberValue(record.createdAt, now),
    updatedAt: numberValue(record.updatedAt, now),
  }
}

export function envVarId(specId: string, envId: string | null, key: string): string {
  return `${specId}::${envId ?? "doc"}::${key}`
}

export function toV6EnvVarRecord(record: Record<string, unknown>): EnvVarEntry {
  const specId = stringValue(record.specId)
  const key = stringValue(record.key)
  const envId = typeof record.envId === "string" && record.envId.length > 0 ? record.envId : null
  return {
    id: envVarId(specId, envId, key),
    specId,
    envId,
    key,
    value: stringValue(record.value),
  }
}

export function mergeEnvVars(documentVars: EnvVarEntry[], environmentVars: EnvVarEntry[]): EnvVarEntry[] {
  const merged = new Map<string, EnvVarEntry>()
  for (const entry of documentVars) merged.set(entry.key, entry)
  for (const entry of environmentVars) merged.set(entry.key, entry)
  return [...merged.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function migrateEnvironmentsToV6(transaction: UpgradeTransaction): void {
  if (!transaction.objectStoreNames.contains("environments")) return
  if (!transaction.objectStoreNames.contains("environmentCredentials")) return

  const envStore = transaction.objectStore("environments")
  const credentialStore = transaction.objectStore("environmentCredentials")

  envStore.openCursor().then(function migrate(cursor): Promise<void> | undefined {
    if (!cursor) return
    const record = cursor.value as Record<string, unknown>
    const profile = profileFromLegacyEnvironment(record)
    const credential = credentialFromLegacyEnvironment(record)
    credentialStore.put(credential)
    cursor.update(profile)
    return cursor.continue().then(migrate)
  })
}

function migrateEnvVarsToV6(transaction: UpgradeTransaction): void {
  if (!transaction.objectStoreNames.contains("envVars")) return
  const store = transaction.objectStore("envVars")
  store.openCursor().then(function migrate(cursor): Promise<void> | undefined {
    if (!cursor) return
    const next = toV6EnvVarRecord(cursor.value as Record<string, unknown>)
    const keyChanged = (cursor.value as Record<string, unknown>).id !== next.id
    if (keyChanged) {
      cursor.delete()
      store.put(next)
    } else {
      cursor.update(next)
    }
    return cursor.continue().then(migrate)
  })
}

function migrateHistoryToV6(transaction: UpgradeTransaction): void {
  if (transaction.objectStoreNames.contains("history")) {
    const store = transaction.objectStore("history")
    store.openCursor().then(function migrate(cursor): Promise<void> | undefined {
      if (!cursor) return
      const record = cursor.value as Record<string, unknown>
      if (!("envId" in record)) record.envId = null
      if (!("envNameSnapshot" in record)) record.envNameSnapshot = null
      cursor.update(record)
      return cursor.continue().then(migrate)
    })
  }

  if (transaction.objectStoreNames.contains("wsHistory")) {
    const store = transaction.objectStore("wsHistory")
    store.openCursor().then(function migrate(cursor): Promise<void> | undefined {
      if (!cursor) return
      const record = cursor.value as Record<string, unknown>
      if (!("envId" in record)) record.envId = null
      if (!("envNameSnapshot" in record)) record.envNameSnapshot = null
      cursor.update(record)
      return cursor.continue().then(migrate)
    })
  }
}

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        createStoresAndIndexes(db)
        ensureIndexesForExistingStores(transaction)

        // v3 -> v4: add stage and specPath to existing environment records
        if (oldVersion > 0 && oldVersion < 4 && db.objectStoreNames.contains("environments")) {
          const store = transaction.objectStore("environments")
          store.openCursor().then(function migrate(cursor): Promise<void> | undefined {
            if (!cursor) return
            const record = cursor.value as Record<string, unknown>
            if (!("stage" in record)) {
              record.stage = ""
              record.specPath = ""
              cursor.update(record)
            }
            return cursor.continue().then(migrate)
          })
        }

        if (oldVersion < 6) {
          migrateEnvironmentsToV6(transaction)
          migrateEnvVarsToV6(transaction)
          migrateHistoryToV6(transaction)
        }
      },
    })
  }
  return dbPromise
}

export function resetDBConnectionForTests(): void {
  dbPromise = null
}

function truncateBody(response: RequestResponse): RequestResponse {
  if (response.body && response.body.length > MAX_BODY_SIZE) {
    return { ...response, body: response.body.slice(0, MAX_BODY_SIZE) + "\n\n[truncated]" }
  }
  return response
}

function getOrigin(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function getSpecOrigin(spec: OpenAPISpec, specUrl: string): string {
  const firstServer = spec.servers?.[0]
  if (firstServer) return getOrigin(resolveServerUrl(firstServer))
  if (spec.host) return spec.host
  if (specUrl) return getOrigin(specUrl)
  return "local"
}

function hashString(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function hashSpec(spec: OpenAPISpec): string {
  try {
    return hashString(JSON.stringify(spec))
  } catch {
    return hashString(`${spec.info?.title ?? ""}:${spec.info?.version ?? ""}`)
  }
}

export function createSpecRecord(
  spec: OpenAPISpec,
  specUrl: string,
  sourceType: SpecSourceType,
  existing?: SpecRecord | null,
  now = Date.now(),
): SpecRecord {
  return {
    id: computeSpecId(spec, specUrl),
    sourceType,
    specUrl,
    title: spec.info?.title || "API",
    version: spec.info?.version || "",
    origin: getSpecOrigin(spec, specUrl),
    contentHash: hashSpec(spec),
    lastOpenedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export async function putSpecFromDocument(
  spec: OpenAPISpec,
  specUrl: string,
  sourceType: SpecSourceType,
): Promise<SpecRecord> {
  const db = await getDB()
  const id = computeSpecId(spec, specUrl)
  const existing = await db.get("specs", id) as SpecRecord | undefined
  const record = createSpecRecord(spec, specUrl, sourceType, existing ?? null)
  await db.put("specs", record)
  return record
}

export async function getSpecs(): Promise<SpecRecord[]> {
  const db = await getDB()
  const specs = await db.getAllFromIndex("specs", "lastOpenedAt") as SpecRecord[]
  return specs.sort((a, b) => {
    const opened = b.lastOpenedAt - a.lastOpenedAt
    return opened !== 0 ? opened : b.updatedAt - a.updatedAt
  })
}

export async function getLatestSpec(): Promise<SpecRecord | null> {
  return (await getSpecs())[0] ?? null
}

export async function touchSpec(specId: string): Promise<void> {
  const db = await getDB()
  const spec = await db.get("specs", specId) as SpecRecord | undefined
  if (!spec) return
  const now = Date.now()
  await db.put("specs", { ...spec, lastOpenedAt: now, updatedAt: now })
}

async function deleteAllFromIndex(storeName: string, indexName: string, query: IDBValidKey | IDBKeyRange): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(storeName, "readwrite")
  const index = tx.store.index(indexName)
  let cursor = await index.openCursor(query)
  while (cursor) {
    cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

async function deleteWsHistoryForSpec(specId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("wsHistory", "readwrite")
  let cursor = await tx.store.openCursor()
  while (cursor) {
    const record = cursor.value as WsHistoryEntry
    if (record.specId === specId) cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function deleteSpec(specId: string): Promise<void> {
  const db = await getDB()
  const environments = await db.getAllFromIndex("environments", "specId", specId) as EnvironmentProfile[]

  await Promise.all(environments.map(env => db.delete("environmentCredentials", env.id)))
  await Promise.all([
    deleteAllFromIndex("environments", "specId", specId),
    deleteAllFromIndex("envVars", "specId", specId),
    deleteAllFromIndex("favorites", "specId", specId),
    deleteAllFromIndex("history", "specId", specId),
    deleteWsHistoryForSpec(specId),
    db.delete("specSettings", specId),
    db.delete("specs", specId),
  ])
}

export async function getSpecSettings(specId: string): Promise<SpecSettings | null> {
  const db = await getDB()
  return (await db.get("specSettings", specId) as SpecSettings | undefined) ?? null
}

export async function putSpecSettings(settings: SpecSettings): Promise<void> {
  const db = await getDB()
  await db.put("specSettings", settings)
}

export async function setActiveEnvironmentForSpec(specId: string, activeEnvId: string | null): Promise<void> {
  await putSpecSettings({ specId, activeEnvId, updatedAt: Date.now() })
}

// --- Legacy LocalStorage migration helpers ---

export function readLegacySettingsFromLocalStorage(): LegacySettingsSnapshot {
  if (typeof localStorage === "undefined") {
    return {
      specUrl: "",
      baseUrl: "",
      authType: "none",
      authToken: "",
      authUser: "",
      authKeyName: "",
      oauth2Token: null,
      activeEnvId: null,
    }
  }
  return {
    specUrl: localStorage.getItem(LEGACY_LS_KEYS.url) || "",
    baseUrl: localStorage.getItem(LEGACY_LS_KEYS.base) || "",
    authType: authTypeValue(localStorage.getItem(LEGACY_LS_KEYS.authType)),
    authToken: localStorage.getItem(LEGACY_LS_KEYS.authToken) || "",
    authUser: localStorage.getItem(LEGACY_LS_KEYS.authUser) || "",
    authKeyName: localStorage.getItem(LEGACY_LS_KEYS.authKeyName) || "",
    oauth2Token: localStorage.getItem(LEGACY_LS_KEYS.oauth2Token),
    activeEnvId: localStorage.getItem(LEGACY_LS_KEYS.activeEnvId),
  }
}

export function clearLegacyBusinessLocalStorage(): void {
  if (typeof localStorage === "undefined") return
  for (const key of Object.values(LEGACY_LS_KEYS)) {
    localStorage.removeItem(key)
  }
}

// --- History ---

export async function addHistoryEntry(entry: Omit<HistoryEntry, "id">): Promise<void> {
  const db = await getDB()
  await db.add("history", { ...entry, response: truncateBody(entry.response) })
}

export async function getHistory(
  specId: string,
  routeKey: string,
  options: { envId?: string | null; limit?: number } = {},
): Promise<HistoryEntry[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex("history", "specId_routeKey", [specId, routeKey]) as HistoryEntry[]
  const filtered = "envId" in options
    ? all.filter(entry => (entry.envId ?? null) === options.envId)
    : all
  return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, options.limit ?? 50)
}

export async function clearHistory(
  specId: string,
  routeKey?: string,
  envId?: string | null,
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("history", "readwrite")
  const index = routeKey
    ? tx.store.index("specId_routeKey")
    : tx.store.index("specId")
  const key = routeKey ? [specId, routeKey] : specId
  let cursor = await index.openCursor(key)
  while (cursor) {
    const record = cursor.value as HistoryEntry
    if (envId === undefined || (record.envId ?? null) === envId) cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

// --- Favorites ---

export async function addFavorite(specId: string, routeKey: string): Promise<void> {
  const db = await getDB()
  const id = `${specId}::${routeKey}`
  await db.put("favorites", { id, specId, routeKey, createdAt: Date.now() })
}

export async function removeFavorite(specId: string, routeKey: string): Promise<void> {
  const db = await getDB()
  const id = `${specId}::${routeKey}`
  await db.delete("favorites", id)
}

export async function getFavorites(specId: string): Promise<Set<string>> {
  const db = await getDB()
  const entries = await db.getAllFromIndex("favorites", "specId", specId) as FavoriteEntry[]
  return new Set(entries.map(e => e.routeKey))
}

// --- Env Vars ---

export async function getEnvVars(specId: string, envId?: string | null): Promise<EnvVarEntry[]> {
  const db = await getDB()
  const entries = await db.getAllFromIndex("envVars", "specId", specId) as EnvVarEntry[]
  const filtered = envId === undefined
    ? entries
    : entries.filter(entry => (entry.envId ?? null) === envId)
  return filtered.sort((a, b) => a.key.localeCompare(b.key))
}

export async function getMergedEnvVars(specId: string, envId: string | null): Promise<EnvVarEntry[]> {
  const documentVars = await getEnvVars(specId, null)
  const environmentVars = envId ? await getEnvVars(specId, envId) : []
  return mergeEnvVars(documentVars, environmentVars)
}

export async function setEnvVar(specId: string, key: string, value: string, envId: string | null): Promise<void> {
  const db = await getDB()
  await db.put("envVars", { id: envVarId(specId, envId, key), specId, envId, key, value })
}

export async function removeEnvVar(specId: string, key: string, envId: string | null): Promise<void> {
  const db = await getDB()
  await db.delete("envVars", envVarId(specId, envId, key))
}

async function removeEnvVarsForEnvironment(envId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("envVars", "readwrite")
  let cursor = await tx.store.openCursor()
  while (cursor) {
    const record = cursor.value as EnvVarEntry
    if (record.envId === envId) cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export function interpolateEnvVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match)
}

// --- Environments ---

export async function getEnvironments(specId: string): Promise<EnvironmentProfile[]> {
  const db = await getDB()
  const entries = await db.getAllFromIndex("environments", "specId", specId) as EnvironmentProfile[]
  return entries.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getEnvironmentCredential(envId: string): Promise<EnvironmentCredential> {
  const db = await getDB()
  const credential = await db.get("environmentCredentials", envId) as EnvironmentCredential | undefined
  return credential ?? createEmptyEnvironmentCredential(envId)
}

export async function getEnvironmentRuntimes(specId: string): Promise<EnvironmentRuntime[]> {
  const profiles = await getEnvironments(specId)
  const credentials = await Promise.all(profiles.map(profile => getEnvironmentCredential(profile.id)))
  return profiles.map((profile, index) => ({ ...profile, ...credentials[index]! }))
}

export async function putEnvironment(profile: EnvironmentProfile): Promise<void> {
  const db = await getDB()
  await db.put("environments", profile)
}

export async function putEnvironmentCredential(credential: EnvironmentCredential): Promise<void> {
  const db = await getDB()
  await db.put("environmentCredentials", { ...credential, updatedAt: Date.now() })
}

export async function removeEnvironment(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("environments", id)
  await db.delete("environmentCredentials", id)
  await removeEnvVarsForEnvironment(id)
}

// --- WebSocket History ---

export async function addWsHistoryEntry(entry: Omit<WsHistoryEntry, "id">): Promise<void> {
  const db = await getDB()
  const body = entry.body.length > MAX_BODY_SIZE
    ? entry.body.slice(0, MAX_BODY_SIZE) + "\n\n[truncated]"
    : entry.body
  await db.add("wsHistory", { ...entry, body })
}

export async function getWsHistory(
  specId: string,
  channelId: string,
  options: { envId?: string | null; limit?: number } = {},
): Promise<WsHistoryEntry[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex("wsHistory", "specId_channelId", [specId, channelId]) as WsHistoryEntry[]
  const filtered = "envId" in options
    ? all.filter(entry => (entry.envId ?? null) === options.envId)
    : all
  return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, options.limit ?? 100)
}

export async function clearWsHistory(specId: string, channelId?: string, envId?: string | null): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("wsHistory", "readwrite")
  const index = tx.store.index("specId_channelId")
  let cursor = await index.openCursor()
  while (cursor) {
    const record = cursor.value as WsHistoryEntry
    const channelMatches = !channelId || record.channelId === channelId
    const envMatches = envId === undefined || (record.envId ?? null) === envId
    if (record.specId === specId && channelMatches && envMatches) cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}
