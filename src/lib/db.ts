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

const DB_NAME = "apilot"
const DB_VERSION = 2
const MAX_BODY_SIZE = 100 * 1024

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
