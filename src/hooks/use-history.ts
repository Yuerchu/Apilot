import { useState, useEffect, useCallback } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { useEnvironments } from "@/hooks/use-environments"
import { getHistory, addHistoryEntry, clearHistory, type HistoryEntry } from "@/lib/db"

export type HistoryEnvFilter = "current" | "all"

export function useHistory(routeKey: string) {
  const specId = useSpecId()
  const { activeEnvId, activeEnv } = useEnvironments()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [envFilter, setEnvFilter] = useState<HistoryEnvFilter>("current")

  const reload = useCallback(() => {
    if (!specId || !routeKey) { setEntries([]); return }
    const options = envFilter === "current" ? { envId: activeEnvId } : {}
    getHistory(specId, routeKey, options).then(setEntries)
  }, [specId, routeKey, envFilter, activeEnvId])

  useEffect(() => { reload() }, [reload])

  const addEntry = useCallback(async (data: Omit<HistoryEntry, "id" | "specId" | "envId" | "envNameSnapshot" | "timestamp">) => {
    if (!specId) return
    await addHistoryEntry({
      ...data,
      specId,
      envId: activeEnvId,
      envNameSnapshot: activeEnv?.name ?? null,
      timestamp: Date.now(),
    })
    reload()
  }, [specId, activeEnvId, activeEnv?.name, reload])

  const clearEntries = useCallback(async () => {
    if (!specId) return
    await clearHistory(specId, routeKey, envFilter === "current" ? activeEnvId : undefined)
    setEntries([])
  }, [specId, routeKey, envFilter, activeEnvId])

  return { entries, addEntry, clearEntries, envFilter, setEnvFilter }
}
