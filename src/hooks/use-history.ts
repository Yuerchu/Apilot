import { useState, useEffect, useCallback } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { getHistory, addHistoryEntry, clearHistory, type HistoryEntry } from "@/lib/db"

export function useHistory(routeKey: string) {
  const specId = useSpecId()
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  const reload = useCallback(() => {
    if (!specId || !routeKey) { setEntries([]); return }
    getHistory(specId, routeKey).then(setEntries)
  }, [specId, routeKey])

  useEffect(() => { reload() }, [reload])

  const addEntry = useCallback(async (data: Omit<HistoryEntry, "id" | "specId" | "timestamp">) => {
    if (!specId) return
    await addHistoryEntry({ ...data, specId, timestamp: Date.now() })
    reload()
  }, [specId, reload])

  const clearEntries = useCallback(async () => {
    if (!specId) return
    await clearHistory(specId, routeKey)
    setEntries([])
  }, [specId, routeKey])

  return { entries, addEntry, clearEntries }
}
