import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getDB } from "@/lib/db"

const LS_PREFIX = "oa_"

const LS_DESCRIPTIONS: Record<string, string> = {
  oa_locale: "storage.desc.locale",
  oa_theme: "storage.desc.theme",
  oa_specUrl: "storage.desc.specUrl",
  oa_baseUrl: "storage.desc.baseUrl",
  oa_authType: "storage.desc.authType",
  oa_authToken: "storage.desc.authToken",
  oa_authUser: "storage.desc.authUser",
  oa_authKeyName: "storage.desc.authKeyName",
  oa_oauth2Token: "storage.desc.oauth2Token",
}

interface LsEntry {
  key: string
  value: string
}

interface DbStoreInfo {
  name: string
  count: number
  labelKey: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StorageSettings() {
  const { t } = useTranslation()
  const [lsEntries, setLsEntries] = useState<LsEntry[]>([])
  const [lsSize, setLsSize] = useState(0)
  const [dbStores, setDbStores] = useState<DbStoreInfo[]>([])
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  const loadLs = useCallback(() => {
    const entries: LsEntry[] = []
    let size = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(LS_PREFIX)) continue
      const value = localStorage.getItem(key) ?? ""
      entries.push({ key, value })
      size += key.length + value.length
    }
    entries.sort((a, b) => a.key.localeCompare(b.key))
    setLsEntries(entries)
    setLsSize(size * 2) // UTF-16
  }, [])

  const loadDb = useCallback(async () => {
    try {
      const db = await getDB()
      const storeNames: { name: string; labelKey: string }[] = [
        { name: "history", labelKey: "storage.history" },
        { name: "favorites", labelKey: "storage.favorites" },
        { name: "envVars", labelKey: "storage.envVars" },
      ]
      const infos: DbStoreInfo[] = []
      for (const store of storeNames) {
        if (db.objectStoreNames.contains(store.name)) {
          const count = await db.count(store.name)
          infos.push({ name: store.name, count, labelKey: store.labelKey })
        }
      }
      setDbStores(infos)
    } catch {
      setDbStores([])
    }
  }, [])

  useEffect(() => {
    loadLs()
    loadDb()
  }, [loadLs, loadDb])

  const removeLsKey = (key: string) => {
    localStorage.removeItem(key)
    loadLs()
  }

  const clearDbStore = async (storeName: string) => {
    const db = await getDB()
    await db.clear(storeName)
    loadDb()
  }

  const clearAll = async () => {
    // Clear localStorage
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LS_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)

    // Clear IndexedDB
    const db = await getDB()
    for (const store of dbStores) {
      if (db.objectStoreNames.contains(store.name)) {
        await db.clear(store.name)
      }
    }

    setConfirmClearAll(false)
    loadLs()
    loadDb()
  }

  const totalDbCount = dbStores.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="space-y-6">
      {/* LocalStorage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">LocalStorage</h3>
          <Badge variant="outline" className="text-[10px] font-mono">{formatBytes(lsSize)}</Badge>
        </div>
        {lsEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("storage.empty")}</p>
        ) : (
          <div className="rounded-md border divide-y">
            {lsEntries.map(entry => (
              <div key={entry.key} className="flex items-center gap-2 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-foreground shrink-0">{entry.key}</span>
                    {entry.value && (
                      <span className="truncate font-mono text-muted-foreground" title={entry.value}>
                        {entry.value.length > 40 ? entry.value.substring(0, 40) + "..." : entry.value}
                      </span>
                    )}
                  </div>
                  {LS_DESCRIPTIONS[entry.key] && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">{t(LS_DESCRIPTIONS[entry.key]!)}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeLsKey(entry.key)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* IndexedDB */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">IndexedDB</h3>
          <Badge variant="outline" className="text-[10px] font-mono">
            {totalDbCount} {t("storage.records")}
          </Badge>
        </div>
        {dbStores.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("storage.empty")}</p>
        ) : (
          <div className="rounded-md border divide-y">
            {dbStores.map(store => (
              <div key={store.name} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="flex-1">{t(store.labelKey)}</span>
                <Badge variant="secondary" className="text-[10px]">{store.count}</Badge>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => clearDbStore(store.name)}
                  disabled={store.count === 0}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Clear all */}
      <div>
        {confirmClearAll ? (
          <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <AlertTriangle className="size-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive flex-1">{t("storage.confirmClear")}</span>
            <Button variant="destructive" size="sm" onClick={clearAll}>
              {t("storage.confirm")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmClearAll(false)}>
              {t("storage.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => setConfirmClearAll(true)}
          >
            <Trash2 className="size-4" />
            {t("storage.clearAll")}
          </Button>
        )}
      </div>
    </div>
  )
}
