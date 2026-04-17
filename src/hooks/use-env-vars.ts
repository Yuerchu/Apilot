import { useState, useEffect, useCallback } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { getEnvVars, setEnvVar, removeEnvVar, type EnvVarEntry } from "@/lib/db"

export function useEnvVars() {
  const specId = useSpecId()
  const [vars, setVars] = useState<EnvVarEntry[]>([])

  useEffect(() => {
    if (!specId) { setVars([]); return }
    getEnvVars(specId).then(setVars)
  }, [specId])

  const varsMap = Object.fromEntries(vars.map(v => [v.key, v.value]))

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

  return { vars, varsMap, set, remove }
}
