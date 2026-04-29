import { useState, useEffect, useCallback } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { useEnvironments } from "@/hooks/use-environments"
import {
  getEnvVars,
  mergeEnvVars,
  removeEnvVar,
  setEnvVar,
  type EnvVarEntry,
} from "@/lib/db"

export type EnvVarScope = "document" | "environment"

export function useEnvVars() {
  const specId = useSpecId()
  const { activeEnvId } = useEnvironments()
  const [documentVars, setDocumentVars] = useState<EnvVarEntry[]>([])
  const [environmentVars, setEnvironmentVars] = useState<EnvVarEntry[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!specId) return
    let cancelled = false
    Promise.all([
      getEnvVars(specId, null),
      activeEnvId ? getEnvVars(specId, activeEnvId) : Promise.resolve([]),
    ]).then(([docResult, envResult]) => {
      if (!cancelled) {
        setDocumentVars(docResult)
        setEnvironmentVars(envResult)
        setLoadedKey(`${specId}::${activeEnvId ?? "none"}`)
      }
    })
    return () => { cancelled = true }
  }, [specId, activeEnvId])

  const currentKey = specId ? `${specId}::${activeEnvId ?? "none"}` : null
  const isLoaded = !!specId && loadedKey === currentKey
  const effectiveDocumentVars = isLoaded ? documentVars : []
  const effectiveEnvironmentVars = isLoaded ? environmentVars : []
  const vars = mergeEnvVars(effectiveDocumentVars, effectiveEnvironmentVars)
  const varsMap = Object.fromEntries(vars.map(v => [v.key, v.value]))

  const set = useCallback(async (key: string, value: string, scope: EnvVarScope = "environment") => {
    if (!specId) return
    const envId = scope === "environment" ? activeEnvId : null
    await setEnvVar(specId, key, value, envId)
    const entry: EnvVarEntry = {
      id: `${specId}::${envId ?? "doc"}::${key}`,
      specId,
      envId,
      key,
      value,
    }
    if (scope === "environment") {
      setEnvironmentVars(prev => {
        const next = prev.filter(v => v.key !== key)
        next.push(entry)
        return next.sort((a, b) => a.key.localeCompare(b.key))
      })
      return
    }
    setDocumentVars(prev => {
      const next = prev.filter(v => v.key !== key)
      next.push(entry)
      return next.sort((a, b) => a.key.localeCompare(b.key))
    })
  }, [specId, activeEnvId])

  const remove = useCallback(async (key: string, scope: EnvVarScope = "environment") => {
    if (!specId) return
    const envId = scope === "environment" ? activeEnvId : null
    await removeEnvVar(specId, key, envId)
    if (scope === "environment") {
      setEnvironmentVars(prev => prev.filter(v => v.key !== key))
      return
    }
    setDocumentVars(prev => prev.filter(v => v.key !== key))
  }, [specId, activeEnvId])

  return {
    vars,
    varsMap,
    documentVars: effectiveDocumentVars,
    environmentVars: effectiveEnvironmentVars,
    set,
    remove,
    activeEnvId,
  }
}
