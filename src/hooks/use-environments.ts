import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useAuthContext } from "@/contexts/AuthContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { getEnvironments, putEnvironment, removeEnvironment as removeEnvFromDB } from "@/lib/db"
import type { EnvironmentProfile } from "@/lib/db"

const LS_ACTIVE_ENV = "oa_activeEnvId"

export interface EnvironmentsContextValue {
  environments: EnvironmentProfile[]
  activeEnvId: string | null
  activeEnv: EnvironmentProfile | null
  loading: boolean
  switchEnvironment: (id: string) => void
  addEnvironment: (name: string, baseUrl: string) => Promise<void>
  updateEnvironment: (id: string, updates: Partial<Pick<EnvironmentProfile, "name" | "baseUrl">>) => Promise<void>
  removeEnvironment: (id: string) => Promise<void>
}

export const EnvironmentsContext = createContext<EnvironmentsContextValue | null>(null)

export function useEnvironmentsProvider(): EnvironmentsContextValue {
  const specId = useSpecId()
  const { state, setBaseUrl } = useOpenAPIContext()
  const auth = useAuthContext()
  const { getServers } = useOpenAPI()

  const [environments, setEnvironments] = useState<EnvironmentProfile[]>([])
  const [activeEnvId, setActiveEnvId] = useState<string | null>(
    localStorage.getItem(LS_ACTIVE_ENV),
  )
  const [loading, setLoading] = useState(false)

  // Prevent auto-save during restore
  const restoringRef = useRef(false)
  const specIdRef = useRef(specId)
  specIdRef.current = specId

  // Load environments when specId changes
  useEffect(() => {
    if (!specId) {
      setEnvironments([])
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const existing = await getEnvironments(specId)

      if (cancelled) return

      if (existing.length > 0) {
        setEnvironments(existing)

        // Restore active environment
        const savedId = localStorage.getItem(LS_ACTIVE_ENV)
        const match = existing.find(e => e.id === savedId)
        if (match) {
          restoringRef.current = true
          setActiveEnvId(match.id)
          setBaseUrl(match.baseUrl)
          auth.restoreAuth({
            authType: match.authType,
            authToken: match.authToken,
            authUser: match.authUser,
            authKeyName: match.authKeyName,
            oauth2Token: match.oauth2Token ?? "",
          })
          setTimeout(() => { restoringRef.current = false }, 100)
        } else {
          // Saved env not found, select first
          const first = existing[0]!
          setActiveEnvId(first.id)
          localStorage.setItem(LS_ACTIVE_ENV, first.id)
        }
      } else {
        // Seed from spec.servers[]
        const servers = getServers()
        const now = Date.now()
        const profiles: EnvironmentProfile[] = []

        for (let i = 0; i < servers.length; i++) {
          const s = servers[i]!
          profiles.push({
            id: crypto.randomUUID(),
            specId,
            name: s.description || s.url,
            baseUrl: s.url,
            authType: "none",
            authToken: "",
            authUser: "",
            authKeyName: "",
            oauth2Token: null,
            source: "spec",
            createdAt: now,
            updatedAt: now,
          })
        }

        // If no servers in spec, create a default from current state
        if (profiles.length === 0) {
          profiles.push({
            id: crypto.randomUUID(),
            specId,
            name: "Default",
            baseUrl: state.baseUrl || "",
            authType: auth.authType,
            authToken: auth.authToken,
            authUser: auth.authUser,
            authKeyName: auth.authKeyName,
            oauth2Token: auth.oauth2Token,
            source: "custom",
            createdAt: now,
            updatedAt: now,
          })
        } else {
          // Check if current auth is configured — if so, apply it to the matching server profile
          const currentBaseUrl = state.baseUrl
          const matchingSpec = profiles.find(p => p.baseUrl === currentBaseUrl)
          if (matchingSpec && auth.authType !== "none") {
            matchingSpec.authType = auth.authType
            matchingSpec.authToken = auth.authToken
            matchingSpec.authUser = auth.authUser
            matchingSpec.authKeyName = auth.authKeyName
            matchingSpec.oauth2Token = auth.oauth2Token
          }
        }

        // Save all to IndexedDB
        for (const p of profiles) {
          await putEnvironment(p)
        }

        if (cancelled) return

        setEnvironments(profiles)

        // Auto-select: prefer matching current baseUrl, else first
        const current = profiles.find(p => p.baseUrl === state.baseUrl) ?? profiles[0]!
        setActiveEnvId(current.id)
        localStorage.setItem(LS_ACTIVE_ENV, current.id)
      }

      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [specId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save auth changes back to active environment (debounced)
  useEffect(() => {
    if (restoringRef.current || !activeEnvId || !specIdRef.current) return

    const timer = setTimeout(() => {
      const env = environments.find(e => e.id === activeEnvId)
      if (!env) return

      const updated: EnvironmentProfile = {
        ...env,
        baseUrl: state.baseUrl,
        authType: auth.authType,
        authToken: auth.authToken,
        authUser: auth.authUser,
        authKeyName: auth.authKeyName,
        oauth2Token: auth.oauth2Token,
        updatedAt: Date.now(),
      }
      putEnvironment(updated)
      setEnvironments(prev => prev.map(e => e.id === activeEnvId ? updated : e))
    }, 500)

    return () => clearTimeout(timer)
  }, [auth.authType, auth.authToken, auth.authUser, auth.authKeyName, auth.oauth2Token, state.baseUrl, activeEnvId]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchEnvironment = useCallback((id: string) => {
    const env = environments.find(e => e.id === id)
    if (!env) return

    restoringRef.current = true
    setActiveEnvId(id)
    localStorage.setItem(LS_ACTIVE_ENV, id)
    setBaseUrl(env.baseUrl)
    auth.restoreAuth({
      authType: env.authType,
      authToken: env.authToken,
      authUser: env.authUser,
      authKeyName: env.authKeyName,
      oauth2Token: env.oauth2Token ?? "",
    })
    setTimeout(() => { restoringRef.current = false }, 100)
  }, [environments, setBaseUrl, auth])

  const addEnvironment = useCallback(async (name: string, baseUrl: string) => {
    if (!specIdRef.current) return
    const now = Date.now()
    const profile: EnvironmentProfile = {
      id: crypto.randomUUID(),
      specId: specIdRef.current,
      name,
      baseUrl,
      authType: "none",
      authToken: "",
      authUser: "",
      authKeyName: "",
      oauth2Token: null,
      source: "custom",
      createdAt: now,
      updatedAt: now,
    }
    await putEnvironment(profile)
    setEnvironments(prev => [...prev, profile])
  }, [])

  const updateEnvironment = useCallback(async (id: string, updates: Partial<Pick<EnvironmentProfile, "name" | "baseUrl">>) => {
    const env = environments.find(e => e.id === id)
    if (!env) return
    const updated = { ...env, ...updates, updatedAt: Date.now() }
    await putEnvironment(updated)
    setEnvironments(prev => prev.map(e => e.id === id ? updated : e))
    // If updating the active env's baseUrl, apply it
    if (id === activeEnvId && updates.baseUrl) {
      setBaseUrl(updates.baseUrl)
    }
  }, [environments, activeEnvId, setBaseUrl])

  const removeEnvironmentFn = useCallback(async (id: string) => {
    await removeEnvFromDB(id)
    const remaining = environments.filter(e => e.id !== id)
    setEnvironments(remaining)
    // If deleted the active one, switch to first remaining
    if (id === activeEnvId && remaining.length > 0) {
      switchEnvironment(remaining[0]!.id)
    }
  }, [environments, activeEnvId, switchEnvironment])

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
