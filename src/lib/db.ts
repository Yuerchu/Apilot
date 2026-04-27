import { openDB, type IDBPDatabase } from "idb"
import type { RequestResponse } from "@/lib/openapi/types"

export interface HistoryEntry {
  id?: number
  specId: string
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
}

export interface EnvVarEntry {
  id: string
  specId: string
  key: string
  value: string
}

export type EnvironmentStage = "local" | "development" | "testing" | "staging" | "production" | ""

export interface EnvironmentProfile {
  id: string
  specId: string
  name: string
  baseUrl: string
  authType: string
  authToken: string
  authUser: string
  authKeyName: string
  oauth2Token: string | null
  source: "spec" | "custom"
  stage: EnvironmentStage
  specPath: string
  createdAt: number
  updatedAt: number
}

export interface WsHistoryEntry {
  id?: number
  specId: string
  channelId: string
  direction: "sent" | "received"
  body: string
  messageType: string
  timestamp: number
}

const DB_NAME = "apilot"
const DB_VERSION = 5
const MAX_BODY_SIZE = 100 * 1024

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains("history")) {
          const history = db.createObjectStore("history", { keyPath: "id", autoIncrement: true })
          history.createIndex("specId", "specId")
          history.createIndex("specId_routeKey", ["specId", "routeKey"])
          history.createIndex("timestamp", "timestamp")
        }
        if (!db.objectStoreNames.contains("favorites")) {
          const favorites = db.createObjectStore("favorites", { keyPath: "id" })
          favorites.createIndex("specId", "specId")
        }
        if (!db.objectStoreNames.contains("envVars")) {
          const envVars = db.createObjectStore("envVars", { keyPath: "id" })
          envVars.createIndex("specId", "specId")
        }
        if (!db.objectStoreNames.contains("environments")) {
          const environments = db.createObjectStore("environments", { keyPath: "id" })
          environments.createIndex("specId", "specId")
        }
        // v4 → v5: add wsHistory store
        if (!db.objectStoreNames.contains("wsHistory")) {
          const ws = db.createObjectStore("wsHistory", { keyPath: "id", autoIncrement: true })
          ws.createIndex("specId_channelId", ["specId", "channelId"])
          ws.createIndex("timestamp", "timestamp")
        }
        // v3 → v4: add stage and specPath to existing environment records
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
      },
    })
  }
  return dbPromise
}

function truncateBody(response: RequestResponse): RequestResponse {
  if (response.body && response.body.length > MAX_BODY_SIZE) {
    return { ...response, body: response.body.slice(0, MAX_BODY_SIZE) + "\n\n[truncated]" }
  }
  return response
}

export async function addHistoryEntry(entry: Omit<HistoryEntry, "id">): Promise<void> {
  const db = await getDB()
  await db.add("history", { ...entry, response: truncateBody(entry.response) })
}

export async function getHistory(specId: string, routeKey: string, limit = 50): Promise<HistoryEntry[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex("history", "specId_routeKey", [specId, routeKey])
  return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
}

export async function clearHistory(specId: string, routeKey?: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("history", "readwrite")
  const index = routeKey
    ? tx.store.index("specId_routeKey")
    : tx.store.index("specId")
  const key = routeKey ? [specId, routeKey] : specId
  let cursor = await index.openCursor(key)
  while (cursor) {
    cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function addFavorite(specId: string, routeKey: string): Promise<void> {
  const db = await getDB()
  const id = `${specId}::${routeKey}`
  await db.put("favorites", { id, specId, routeKey })
}

export async function removeFavorite(specId: string, routeKey: string): Promise<void> {
  const db = await getDB()
  const id = `${specId}::${routeKey}`
  await db.delete("favorites", id)
}

export async function getFavorites(specId: string): Promise<Set<string>> {
  const db = await getDB()
  const entries = await db.getAllFromIndex("favorites", "specId", specId)
  return new Set(entries.map(e => e.routeKey))
}

// --- Env Vars ---

export async function getEnvVars(specId: string): Promise<EnvVarEntry[]> {
  const db = await getDB()
  return db.getAllFromIndex("envVars", "specId", specId)
}

export async function setEnvVar(specId: string, key: string, value: string): Promise<void> {
  const db = await getDB()
  const id = `${specId}::${key}`
  await db.put("envVars", { id, specId, key, value })
}

export async function removeEnvVar(specId: string, key: string): Promise<void> {
  const db = await getDB()
  const id = `${specId}::${key}`
  await db.delete("envVars", id)
}

export function interpolateEnvVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match)
}

// --- Environments ---

export async function getEnvironments(specId: string): Promise<EnvironmentProfile[]> {
  const db = await getDB()
  return db.getAllFromIndex("environments", "specId", specId)
}

export async function putEnvironment(profile: EnvironmentProfile): Promise<void> {
  const db = await getDB()
  await db.put("environments", profile)
}

export async function removeEnvironment(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("environments", id)
}

// --- WebSocket History ---

export async function addWsHistoryEntry(entry: Omit<WsHistoryEntry, "id">): Promise<void> {
  const db = await getDB()
  const body = entry.body.length > MAX_BODY_SIZE
    ? entry.body.slice(0, MAX_BODY_SIZE) + "\n\n[truncated]"
    : entry.body
  await db.add("wsHistory", { ...entry, body })
}

export async function getWsHistory(specId: string, channelId: string, limit = 100): Promise<WsHistoryEntry[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex("wsHistory", "specId_channelId", [specId, channelId])
  return all.sort((a, b) => (b.timestamp as number) - (a.timestamp as number)).slice(0, limit)
}

export async function clearWsHistory(specId: string, channelId?: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("wsHistory", "readwrite")
  if (channelId) {
    const index = tx.store.index("specId_channelId")
    let cursor = await index.openCursor([specId, channelId])
    while (cursor) {
      cursor.delete()
      cursor = await cursor.continue()
    }
  } else {
    const index = tx.store.index("specId_channelId")
    let cursor = await index.openCursor()
    while (cursor) {
      const record = cursor.value as WsHistoryEntry
      if (record.specId === specId) cursor.delete()
      cursor = await cursor.continue()
    }
  }
  await tx.done
}
