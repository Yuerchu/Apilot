import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  deleteSpec,
  getLatestSpec,
  getSpecs,
  resetDBConnectionForTests,
  touchSpec,
  type EnvVarEntry,
  type EnvironmentCredential,
  type EnvironmentProfile,
  type FavoriteEntry,
  type HistoryEntry,
  type SpecRecord,
  type SpecSettings,
  type WsHistoryEntry,
} from "@/lib/db"

type StoreName =
  | "specs"
  | "specSettings"
  | "environmentCredentials"
  | "environments"
  | "envVars"
  | "history"
  | "favorites"
  | "wsHistory"

type StoreRecord =
  | SpecRecord
  | SpecSettings
  | EnvironmentCredential
  | EnvironmentProfile
  | EnvVarEntry
  | HistoryEntry
  | FavoriteEntry
  | WsHistoryEntry

const openDBMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>())

vi.mock("idb", () => ({
  openDB: openDBMock,
}))

function getRecordKey(storeName: StoreName, record: StoreRecord): IDBValidKey {
  if (storeName === "specSettings") return (record as SpecSettings).specId
  if (storeName === "environmentCredentials") return (record as EnvironmentCredential).envId
  return (record as { id: IDBValidKey }).id
}

function hasSpecId(record: StoreRecord): record is StoreRecord & { specId: string } {
  return "specId" in record && typeof record.specId === "string"
}

function toStoreName(name: string): StoreName {
  return name as StoreName
}

class FakeCursor {
  constructor(
    private readonly entries: Array<[IDBValidKey, StoreRecord]>,
    private readonly position: number,
    private readonly records: Map<IDBValidKey, StoreRecord>,
  ) {}

  get value(): StoreRecord {
    return this.entries[this.position]![1]
  }

  delete(): void {
    const key = this.entries[this.position]![0]
    this.records.delete(key)
  }

  continue(): Promise<FakeCursor | null> {
    const next = this.position + 1
    return Promise.resolve(next < this.entries.length ? new FakeCursor(this.entries, next, this.records) : null)
  }
}

class FakeIndex {
  constructor(
    private readonly indexName: string,
    private readonly records: Map<IDBValidKey, StoreRecord>,
  ) {}

  openCursor(query?: IDBValidKey | IDBKeyRange): Promise<FakeCursor | null> {
    const entries = [...this.records.entries()].filter(([, record]) => {
      if (this.indexName === "specId") return hasSpecId(record) && record.specId === query
      if (this.indexName === "lastOpenedAt") return "lastOpenedAt" in record
      return true
    })
    return Promise.resolve(entries.length > 0 ? new FakeCursor(entries, 0, this.records) : null)
  }
}

class FakeStore {
  constructor(private readonly records: Map<IDBValidKey, StoreRecord>) {}

  index(indexName: string): FakeIndex {
    return new FakeIndex(indexName, this.records)
  }

  openCursor(): Promise<FakeCursor | null> {
    const entries = [...this.records.entries()]
    return Promise.resolve(entries.length > 0 ? new FakeCursor(entries, 0, this.records) : null)
  }
}

class FakeDB {
  readonly stores: Record<StoreName, Map<IDBValidKey, StoreRecord>> = {
    specs: new Map(),
    specSettings: new Map(),
    environmentCredentials: new Map(),
    environments: new Map(),
    envVars: new Map(),
    history: new Map(),
    favorites: new Map(),
    wsHistory: new Map(),
  }

  getAllFromIndex(storeName: string, indexName: string, query?: IDBValidKey): Promise<StoreRecord[]> {
    const records = [...this.stores[toStoreName(storeName)].values()].filter(record => {
      if (indexName === "specId") return hasSpecId(record) && record.specId === query
      return true
    })
    if (indexName === "lastOpenedAt") {
      return Promise.resolve(records.sort((a, b) => {
        const left = "lastOpenedAt" in a ? a.lastOpenedAt : 0
        const right = "lastOpenedAt" in b ? b.lastOpenedAt : 0
        return left - right
      }))
    }
    return Promise.resolve(records)
  }

  get(storeName: string, key: IDBValidKey): Promise<StoreRecord | undefined> {
    return Promise.resolve(this.stores[toStoreName(storeName)].get(key))
  }

  put(storeName: string, record: StoreRecord): Promise<void> {
    const name = toStoreName(storeName)
    this.stores[name].set(getRecordKey(name, record), record)
    return Promise.resolve()
  }

  delete(storeName: string, key: IDBValidKey): Promise<void> {
    this.stores[toStoreName(storeName)].delete(key)
    return Promise.resolve()
  }

  transaction(storeName: string): { store: FakeStore; done: Promise<void> } {
    return {
      store: new FakeStore(this.stores[toStoreName(storeName)]),
      done: Promise.resolve(),
    }
  }
}

function spec(id: string, lastOpenedAt: number): SpecRecord {
  return {
    id,
    sourceType: "url",
    specUrl: `https://example.com/${id}.json`,
    title: id,
    version: "1.0.0",
    origin: "example.com",
    contentHash: id,
    lastOpenedAt,
    createdAt: lastOpenedAt,
    updatedAt: lastOpenedAt,
  }
}

describe("specs db api", () => {
  let db: FakeDB

  beforeEach(() => {
    vi.useRealTimers()
    resetDBConnectionForTests()
    db = new FakeDB()
    openDBMock.mockResolvedValue(db)
  })

  it("returns specs by most recently opened first", async () => {
    db.stores.specs.set("old", spec("old", 100))
    db.stores.specs.set("new", spec("new", 300))
    db.stores.specs.set("mid", spec("mid", 200))

    expect((await getSpecs()).map(item => item.id)).toEqual(["new", "mid", "old"])
    expect((await getLatestSpec())?.id).toBe("new")
  })

  it("updates last opened timestamp", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    db.stores.specs.set("spec-1", spec("spec-1", 100))

    await touchSpec("spec-1")

    expect(db.stores.specs.get("spec-1")).toMatchObject({
      lastOpenedAt: 1_000,
      updatedAt: 1_000,
    })
  })

  it("deletes a spec and its related records", async () => {
    db.stores.specs.set("spec-1", spec("spec-1", 100))
    db.stores.specs.set("spec-2", spec("spec-2", 200))
    db.stores.specSettings.set("spec-1", { specId: "spec-1", activeEnvId: "env-1", updatedAt: 1 })
    db.stores.specSettings.set("spec-2", { specId: "spec-2", activeEnvId: "env-2", updatedAt: 1 })
    db.stores.environments.set("env-1", {
      id: "env-1",
      specId: "spec-1",
      name: "Local",
      baseUrl: "http://localhost",
      source: "custom",
      stage: "local",
      specPath: "",
      createdAt: 1,
      updatedAt: 1,
    })
    db.stores.environments.set("env-2", {
      id: "env-2",
      specId: "spec-2",
      name: "Prod",
      baseUrl: "https://api.example.com",
      source: "custom",
      stage: "production",
      specPath: "",
      createdAt: 1,
      updatedAt: 1,
    })
    db.stores.environmentCredentials.set("env-1", {
      envId: "env-1",
      authType: "bearer",
      authToken: "token",
      authUser: "",
      authKeyName: "",
      oauth2Token: null,
      updatedAt: 1,
    })
    db.stores.environmentCredentials.set("env-2", {
      envId: "env-2",
      authType: "none",
      authToken: "",
      authUser: "",
      authKeyName: "",
      oauth2Token: null,
      updatedAt: 1,
    })
    db.stores.envVars.set("var-1", { id: "var-1", specId: "spec-1", envId: "env-1", key: "token", value: "a" })
    db.stores.envVars.set("var-2", { id: "var-2", specId: "spec-2", envId: "env-2", key: "token", value: "b" })
    db.stores.favorites.set("fav-1", { id: "fav-1", specId: "spec-1", routeKey: "GET /a", createdAt: 1 })
    db.stores.favorites.set("fav-2", { id: "fav-2", specId: "spec-2", routeKey: "GET /b", createdAt: 1 })
    db.stores.history.set(1, {
      id: 1,
      specId: "spec-1",
      envId: "env-1",
      envNameSnapshot: "Local",
      routeKey: "GET /a",
      method: "GET",
      path: "/a",
      requestParams: {},
      requestBody: null,
      contentType: "application/json",
      response: {
        status: 200,
        statusText: "OK",
        elapsed: 1,
        headers: {},
        body: "",
        curlCommand: "",
        requestMethod: "GET",
        requestUrl: "/a",
        requestHeaders: {},
        requestBody: null,
      },
      timestamp: 1,
    })
    db.stores.history.set(2, {
      id: 2,
      specId: "spec-2",
      envId: "env-2",
      envNameSnapshot: "Prod",
      routeKey: "GET /b",
      method: "GET",
      path: "/b",
      requestParams: {},
      requestBody: null,
      contentType: "application/json",
      response: {
        status: 200,
        statusText: "OK",
        elapsed: 1,
        headers: {},
        body: "",
        curlCommand: "",
        requestMethod: "GET",
        requestUrl: "/b",
        requestHeaders: {},
        requestBody: null,
      },
      timestamp: 1,
    })
    db.stores.wsHistory.set(1, {
      id: 1,
      specId: "spec-1",
      envId: "env-1",
      envNameSnapshot: "Local",
      channelId: "events",
      direction: "sent",
      body: "{}",
      messageType: "json",
      timestamp: 1,
    })
    db.stores.wsHistory.set(2, {
      id: 2,
      specId: "spec-2",
      envId: "env-2",
      envNameSnapshot: "Prod",
      channelId: "events",
      direction: "received",
      body: "{}",
      messageType: "json",
      timestamp: 1,
    })

    await deleteSpec("spec-1")

    expect(db.stores.specs.has("spec-1")).toBe(false)
    expect(db.stores.specSettings.has("spec-1")).toBe(false)
    expect(db.stores.environments.has("env-1")).toBe(false)
    expect(db.stores.environmentCredentials.has("env-1")).toBe(false)
    expect(db.stores.envVars.has("var-1")).toBe(false)
    expect(db.stores.favorites.has("fav-1")).toBe(false)
    expect(db.stores.history.has(1)).toBe(false)
    expect(db.stores.wsHistory.has(1)).toBe(false)
    expect(db.stores.specs.has("spec-2")).toBe(true)
    expect(db.stores.environments.has("env-2")).toBe(true)
    expect(db.stores.environmentCredentials.has("env-2")).toBe(true)
    expect(db.stores.envVars.has("var-2")).toBe(true)
    expect(db.stores.favorites.has("fav-2")).toBe(true)
    expect(db.stores.history.has(2)).toBe(true)
    expect(db.stores.wsHistory.has(2)).toBe(true)
  })
})
