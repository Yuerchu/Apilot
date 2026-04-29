import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useAuthContext } from "@/contexts/AuthContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import {
  clearLegacyBusinessLocalStorage,
  createEmptyEnvironmentCredential,
  getEnvironmentRuntimes,
  getSpecSettings,
  putEnvironment,
  putEnvironmentCredential,
  readLegacySettingsFromLocalStorage,
  removeEnvironment as removeEnvFromDB,
  setActiveEnvironmentForSpec,
} from "@/lib/db"
import type {
  EnvironmentCredential,
  EnvironmentProfile,
  EnvironmentRuntime,
  EnvironmentStage,
} from "@/lib/db"

export interface EnvironmentsContextValue {
  environments: EnvironmentRuntime[]
  activeEnvId: string | null
  activeEnv: EnvironmentRuntime | null
  loading: boolean
  switchEnvironment: (id: string) => void
  addEnvironment: (name: string, baseUrl: string, stage?: EnvironmentStage, specPath?: string) => Promise<void>
  updateEnvironment: (id: string, updates: Partial<Pick<EnvironmentProfile, "name" | "baseUrl" | "stage" | "specPath">>) => Promise<void>
  removeEnvironment: (id: string) => Promise<void>
}

export const EnvironmentsContext = createContext<EnvironmentsContextValue | null>(null)

function profileFromRuntime(env: EnvironmentRuntime): EnvironmentProfile {
  return {
    id: env.id,
    specId: env.specId,
    name: env.name,
    baseUrl: env.baseUrl,
    source: env.source,
    stage: env.stage,
    specPath: env.specPath,
    createdAt: env.createdAt,
    updatedAt: env.updatedAt,
  }
}

function hasLegacyCredential(legacy: ReturnType<typeof readLegacySettingsFromLocalStorage>): boolean {
  return legacy.authType !== "none"
    || legacy.authToken.length > 0
    || legacy.authUser.length > 0
    || legacy.authKeyName.length > 0
    || !!legacy.oauth2Token
}

export function useEnvironmentsProvider(): EnvironmentsContextValue {
  const specId = useSpecId()
  const { state, setBaseUrl } = useOpenAPIContext()
  const auth = useAuthContext()
  const { getServers } = useOpenAPI()

  const [environments, setEnvironments] = useState<EnvironmentRuntime[]>([])
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const restoringRef = useRef(false)
  const specIdRef = useRef(specId)
  useEffect(() => { specIdRef.current = specId }, [specId])

  const applyEnvironment = useCallback((env: EnvironmentRuntime) => {
    restoringRef.current = true
    setActiveEnvId(env.id)
    setBaseUrl(env.baseUrl)
    auth.restoreAuth({
      authType: env.authType,
      authToken: env.authToken,
      authUser: env.authUser,
      authKeyName: env.authKeyName,
      oauth2Token: env.oauth2Token,
    })
    setTimeout(() => { restoringRef.current = false }, 100)
  }, [auth, setBaseUrl])

  useEffect(() => {
    if (!specId) {
      setEnvironments([])
      setActiveEnvId(null)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const existing = await getEnvironmentRuntimes(specId)
      const settings = await getSpecSettings(specId)
      const legacy = readLegacySettingsFromLocalStorage()

      if (cancelled) return

      if (existing.length > 0) {
        setEnvironments(existing)
        const savedId = settings?.activeEnvId || legacy.activeEnvId
        const match = existing.find(e => e.id === savedId)
        const selected = match ?? existing[0]!
        applyEnvironment(selected)
        await setActiveEnvironmentForSpec(specId, selected.id)
        clearLegacyBusinessLocalStorage()
        setLoading(false)
        return
      }

      const servers = getServers()
      const now = Date.now()
      const profiles: EnvironmentProfile[] = []

      for (let i = 0; i < servers.length; i++) {
        const server = servers[i]!
        profiles.push({
          id: crypto.randomUUID(),
          specId,
          name: server.description || server.url,
          baseUrl: server.url,
          source: "spec",
          stage: "",
          specPath: "",
          createdAt: now,
          updatedAt: now,
        })
      }

      if (profiles.length === 0) {
        profiles.push({
          id: crypto.randomUUID(),
          specId,
          name: "Default",
          baseUrl: state.baseUrl || legacy.baseUrl || "",
          source: "custom",
          stage: "",
          specPath: "",
          createdAt: now,
          updatedAt: now,
        })
      }

      const current = profiles.find(p => p.baseUrl === state.baseUrl)
        ?? profiles.find(p => p.baseUrl === legacy.baseUrl)
        ?? profiles[0]!

      const runtimes: EnvironmentRuntime[] = []
      for (const profile of profiles) {
        const credential = profile.id === current.id && hasLegacyCredential(legacy)
          ? {
              envId: profile.id,
              authType: legacy.authType,
              authToken: legacy.authToken,
              authUser: legacy.authUser,
              authKeyName: legacy.authKeyName,
              oauth2Token: legacy.oauth2Token,
              updatedAt: now,
            }
          : createEmptyEnvironmentCredential(profile.id, now)
        await putEnvironment(profile)
        await putEnvironmentCredential(credential)
        runtimes.push({ ...profile, ...credential })
      }

      if (cancelled) return

      setEnvironments(runtimes)
      const selected = runtimes.find(env => env.id === current.id) ?? runtimes[0]!
      applyEnvironment(selected)
      await setActiveEnvironmentForSpec(specId, selected.id)
      clearLegacyBusinessLocalStorage()
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [specId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (restoringRef.current || !activeEnvId || !specIdRef.current) return

    const timer = setTimeout(() => {
      const env = environments.find(e => e.id === activeEnvId)
      if (!env) return

      const credential: EnvironmentCredential = {
        envId: activeEnvId,
        authType: auth.authType,
        authToken: auth.authToken,
        authUser: auth.authUser,
        authKeyName: auth.authKeyName,
        oauth2Token: auth.oauth2Token,
        updatedAt: Date.now(),
      }
      putEnvironmentCredential(credential)
      setEnvironments(prev => prev.map(e => e.id === activeEnvId ? { ...e, ...credential } : e))
    }, 500)

    return () => clearTimeout(timer)
  }, [auth.authType, auth.authToken, auth.authUser, auth.authKeyName, auth.oauth2Token, activeEnvId]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchEnvironment = useCallback((id: string) => {
    const env = environments.find(e => e.id === id)
    if (!env || !specIdRef.current) return

    applyEnvironment(env)
    setActiveEnvironmentForSpec(specIdRef.current, id)
  }, [environments, applyEnvironment])

  const addEnvironment = useCallback(async (name: string, baseUrl: string, stage?: EnvironmentStage, specPath?: string) => {
    if (!specIdRef.current) return
    const now = Date.now()
    const profile: EnvironmentProfile = {
      id: crypto.randomUUID(),
      specId: specIdRef.current,
      name,
      baseUrl,
      source: "custom",
      stage: stage || "",
      specPath: specPath || "",
      createdAt: now,
      updatedAt: now,
    }
    const credential = createEmptyEnvironmentCredential(profile.id, now)
    await putEnvironment(profile)
    await putEnvironmentCredential(credential)
    setEnvironments(prev => [...prev, { ...profile, ...credential }])
  }, [])

  const updateEnvironment = useCallback(async (id: string, updates: Partial<Pick<EnvironmentProfile, "name" | "baseUrl" | "stage" | "specPath">>) => {
    const env = environments.find(e => e.id === id)
    if (!env) return
    const updated: EnvironmentRuntime = { ...env, ...updates, updatedAt: Date.now() }
    await putEnvironment(profileFromRuntime(updated))
    setEnvironments(prev => prev.map(e => e.id === id ? updated : e))
    if (id === activeEnvId && updates.baseUrl) {
      setBaseUrl(updates.baseUrl)
    }
  }, [environments, activeEnvId, setBaseUrl])

  const removeEnvironmentFn = useCallback(async (id: string) => {
    await removeEnvFromDB(id)
    const remaining = environments.filter(e => e.id !== id)
    setEnvironments(remaining)
    if (id === activeEnvId && remaining.length > 0) {
      const next = remaining[0]!
      applyEnvironment(next)
      if (specIdRef.current) await setActiveEnvironmentForSpec(specIdRef.current, next.id)
    }
    if (id === activeEnvId && remaining.length === 0) {
      setActiveEnvId(null)
      if (specIdRef.current) await setActiveEnvironmentForSpec(specIdRef.current, null)
    }
  }, [environments, activeEnvId, applyEnvironment])

  const activeEnv = environments.find(e => e.id === activeEnvId) || null

  return {
    environments,
    activeEnvId,
    activeEnv,
    loading,
    switchEnvironment,
    addEnvironment,
    updateEnvironment,
    removeEnvironment: removeEnvironmentFn,
  }
}

export function useEnvironments() {
  const ctx = useContext(EnvironmentsContext)
  if (!ctx) throw new Error("useEnvironments must be used within EnvironmentsContext.Provider")
  return ctx
}
