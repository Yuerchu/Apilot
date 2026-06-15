import { useCallback } from "react"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ParsedRoute } from "@/lib/openapi/types"

export interface FetchJsonResult<T = unknown> {
  data: T | null
  error: string | null
}

export interface SubmitJsonResult {
  ok: boolean
  response: string
}

export function useConsoleFetch() {
  const auth = useAuthContext()
  const { sendRequest, loading, errorRef } = useRequest(auth.getAuthHeaders)

  const fetchJson = useCallback(async <T = unknown>(
    route: ParsedRoute,
    params?: Record<string, string>,
  ): Promise<FetchJsonResult<T>> => {
    const result = await sendRequest(route, params ?? {}, "", "application/json")
    // null = baseUrl missing / validation failure / abort. Surface the validation
    // reason (errorRef) so templates don't render a silent blank; abort leaves it null.
    if (!result) return { data: null, error: errorRef.current }
    if (result.status >= 200 && result.status < 300) {
      try { return { data: JSON.parse(result.body) as T, error: null } }
      catch (e) { return { data: null, error: e instanceof Error ? e.message : "Invalid JSON response" } }
    }
    return { data: null, error: `${result.status} ${result.statusText}` }
  }, [sendRequest, errorRef])

  const submitJson = useCallback(async (
    route: ParsedRoute,
    body: string,
    params?: Record<string, string>,
  ): Promise<SubmitJsonResult> => {
    const result = await sendRequest(route, params ?? {}, body, "application/json")
    if (!result) return { ok: false, response: "" }
    const ok = result.status >= 200 && result.status < 300
    let response: string
    try { response = JSON.stringify(JSON.parse(result.body), null, 2) }
    catch { response = result.body }
    return { ok, response }
  }, [sendRequest])

  const mutate = useCallback(async (
    route: ParsedRoute,
    opts?: {
      body?: string
      params?: Record<string, string>
      contentType?: string
      formData?: Record<string, string | File>
    },
  ): Promise<boolean> => {
    const o = opts ?? {}
    const result = await sendRequest(route, o.params ?? {}, o.body ?? "", o.contentType ?? "application/json", o.formData)
    if (!result) return false
    return result.status >= 200 && result.status < 300
  }, [sendRequest])

  const mutateWithResponse = useCallback(async (
    route: ParsedRoute,
    opts?: {
      body?: string
      params?: Record<string, string>
      contentType?: string
      formData?: Record<string, string | File>
    },
  ): Promise<SubmitJsonResult> => {
    const o = opts ?? {}
    const result = await sendRequest(route, o.params ?? {}, o.body ?? "", o.contentType ?? "application/json", o.formData)
    if (!result) return { ok: false, response: "" }
    const ok = result.status >= 200 && result.status < 300
    let response: string
    try { response = JSON.stringify(JSON.parse(result.body), null, 2) }
    catch { response = result.body }
    return { ok, response }
  }, [sendRequest])

  return { fetchJson, submitJson, mutate, mutateWithResponse, loading }
}
