import { useState, useEffect, useCallback } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { getEnvVars, setEnvVar, removeEnvVar, type EnvVarEntry } from "@/lib/db"

export function useEnvVars() {
  const specId = useSpecId()
  const [vars, setVars] = useState<EnvVarEntry[]>([])
  const [loadedSpecId, setLoadedSpecId] = useState<string | null>(null)

  useEffect(() => {
    if (!specId) return
    let cancelled = false
    getEnvVars(specId).then(result => {
      if (!cancelled) {
        setVars(result)
        setLoadedSpecId(specId)
      }
    })
    return () => { cancelled = true }
  }, [specId])

  // Derive empty when specId is absent or changed but not yet loaded
  const effectiveVars = !specId || loadedSpecId !== specId ? [] : vars

  const varsMap = Object.fromEntries(effectiveVars.map(v => [v.key, v.value]))

  const set = useCallback(async (key: string, value: string) => {
    if (!specId) return
    await setEnvVar(specId, key, value)
    setVars(prev => {
      const next = prev.filter(v => v.key !== key)
      next.push({ id: `${specId}::${key}`, specId, key, value })
      return next
    })
  }, [specId])

  const remove = useCallback(async (key: string) => {
    if (!specId) return
    await removeEnvVar(specId, key)
    setVars(prev => prev.filter(v => v.key !== key))
  }, [specId])

  return { vars: effectiveVars, varsMap, set, remove }
}
