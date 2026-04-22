import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useEnvironments } from "@/hooks/use-environments"
import { extractRouteKeys } from "@/lib/openapi/extract-route-keys"
import { buildAuthHeaders } from "@/lib/request-utils"
import { getParsedRouteKey } from "@/lib/openapi/route-key"
import type { EnvironmentStage } from "@/lib/db"

type EnvFetchStatus = "ok" | "error" | "loading"

interface EnvStatusEntry {
  envId: string
  envName: string
  stage: EnvironmentStage
  routeKeys: Set<string>
  status: EnvFetchStatus
  error?: string
  fetchedAt: number
}

export interface RouteEnvPresence {
  envId: string
  envName: string
  stage: string
  present: boolean
  status: EnvFetchStatus
}

export type InferredStatus = "online" | "testing" | "inDev" | "localOnly" | "teammate" | null

export interface MultiEnvStatusValue {
  envStatuses: EnvStatusEntry[]
  getRoutePresence: (routeKey: string) => RouteEnvPresence[]
  inferStatus: (routeKey: string) => InferredStatus
  loading: boolean
  refresh: () => void
  enabled: boolean
}

export const MultiEnvStatusContext = createContext<MultiEnvStatusValue | null>(null)

const STAGE_ORDER: EnvironmentStage[] = ["production", "staging", "testing", "development", "local"]
const FETCH_TIMEOUT = 10_000

function getDefaultSpecPath(specUrl: string): string {
  if (!specUrl) return "/openapi.json"
  try {
    const u = new URL(specUrl)
    return u.pathname || "/openapi.json"
  } catch {
    return "/openapi.json"
  }
}

export function useMultiEnvStatusProvider(): MultiEnvStatusValue {
  const { state } = useOpenAPIContext()
  const { environments, activeEnvId } = useEnvironments()

  const [envStatuses, setEnvStatuses] = useState<EnvStatusEntry[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const fetchedRef = useRef(false)

  // Environments with a stage set
  const stagedEnvs = useMemo(
    () => environments.filter(e => e.stage !== ""),
    [environments],
  )

  const enabled = stagedEnvs.length >= 2

  // Active env's route keys (already loaded)
  const activeRouteKeys = useMemo(() => {
    if (!state.routes.length) return new Set<string>()
    return new Set(state.routes.map(r => getParsedRouteKey(r)))
  }, [state.routes])

  const defaultSpecPath = useMemo(() => getDefaultSpecPath(state.specUrl), [state.specUrl])

  const fetchEnvSpecs = useCallback(async () => {
    if (!enabled || state.routes.length === 0) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    // Build initial statuses: active env is already "ok"
    const results: EnvStatusEntry[] = []

    // For each staged env, fetch spec or use active route keys
    const fetchPromises = stagedEnvs.map(async (env): Promise<EnvStatusEntry> => {
      if (env.id === activeEnvId) {
        return {
          envId: env.id,
          envName: env.name,
          stage: env.stage,
          routeKeys: activeRouteKeys,
          status: "ok",
          fetchedAt: Date.now(),
        }
      }

      const specUrl = env.baseUrl.replace(/\/+$/, "") + (env.specPath || defaultSpecPath)
      const headers = buildAuthHeaders(env.authType, env.authToken, env.authUser, env.authKeyName, env.oauth2Token)

      try {
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
        const res = await fetch(specUrl, {
          headers,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          return {
            envId: env.id,
            envName: env.name,
            stage: env.stage,
            routeKeys: new Set(),
            status: "error",
            error: `HTTP ${res.status}`,
            fetchedAt: Date.now(),
          }
        }

        const text = await res.text()
        let rawSpec: Record<string, unknown>
        try {
          rawSpec = JSON.parse(text) as Record<string, unknown>
        } catch {
          // Try YAML? For v1, just JSON
          return {
            envId: env.id,
            envName: env.name,
            stage: env.stage,
            routeKeys: new Set(),
            status: "error",
            error: "Invalid JSON",
            fetchedAt: Date.now(),
          }
        }

        return {
          envId: env.id,
          envName: env.name,
          stage: env.stage,
          routeKeys: extractRouteKeys(rawSpec),
          status: "ok",
          fetchedAt: Date.now(),
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return {
            envId: env.id,
            envName: env.name,
            stage: env.stage,
            routeKeys: new Set(),
            status: "error",
            error: "Timeout / Aborted",
            fetchedAt: Date.now(),
          }
        }
        return {
          envId: env.id,
          envName: env.name,
          stage: env.stage,
          routeKeys: new Set(),
          status: "error",
          error: (err as Error).message || "Network error",
          fetchedAt: Date.now(),
        }
      }
    })

    const settled = await Promise.allSettled(fetchPromises)
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value)
      }
    }

    if (!controller.signal.aborted) {
      // Sort by stage priority
      results.sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a.stage as EnvironmentStage)
        const bi = STAGE_ORDER.indexOf(b.stage as EnvironmentStage)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setEnvStatuses(results)
      setLoading(false)
    }
  }, [enabled, stagedEnvs, activeEnvId, activeRouteKeys, defaultSpecPath, state.routes.length])

  // Auto-fetch when spec is loaded and enabled
  useEffect(() => {
    if (!enabled || state.routes.length === 0) {
      setEnvStatuses([])
      fetchedRef.current = false
      return
    }
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchEnvSpecs()
  }, [enabled, state.routes.length, fetchEnvSpecs])

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const refresh = useCallback(() => {
    fetchedRef.current = false
    fetchEnvSpecs()
  }, [fetchEnvSpecs])

  const getRoutePresence = useCallback((routeKey: string): RouteEnvPresence[] => {
    return envStatuses.map(entry => ({
      envId: entry.envId,
      envName: entry.envName,
      stage: entry.stage,
      present: entry.routeKeys.has(routeKey),
      status: entry.status,
    }))
  }, [envStatuses])

  const inferStatus = useCallback((routeKey: string): InferredStatus => {
    if (envStatuses.length === 0) return null

    const presenceByStage = new Map<string, boolean>()
    for (const entry of envStatuses) {
      if (entry.status === "ok") {
        presenceByStage.set(entry.stage, entry.routeKeys.has(routeKey))
      }
    }

    if (presenceByStage.get("production") || presenceByStage.get("staging")) {
      return "online"
    }
    if (presenceByStage.get("testing")) {
      return "testing"
    }
    if (presenceByStage.get("development")) {
      const inLocal = presenceByStage.get("local")
      return inLocal === false ? "teammate" : "inDev"
    }
    if (presenceByStage.get("local")) {
      return "localOnly"
    }

    return null
  }, [envStatuses])

  return {
    envStatuses,
    getRoutePresence,
    inferStatus,
    loading,
    refresh,
    enabled,
  }
}

export function useMultiEnvStatus() {
  const ctx = useContext(MultiEnvStatusContext)
  if (!ctx) throw new Error("useMultiEnvStatus must be used within MultiEnvStatusContext.Provider")
  return ctx
}
