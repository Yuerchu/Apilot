import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import i18n from "@/lib/i18n"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { buildSnippet } from "@/lib/build-snippet"
import { resolveServerUrl } from "@/lib/openapi/parser"
import { isCrossHostTarget, originOf } from "@/lib/openapi/url-guard"
import { validateWithSchema } from "@/lib/validate-schema"
import { findTokenFields } from "@/lib/request-utils"
import type {
  ParsedRoute,
  ValidationError,
  RequestResponse,
} from "@/lib/openapi/types"

export { findTokenFields, buildAuthHeaders } from "@/lib/request-utils"

interface ParamValues {
  [paramName: string]: string
}

interface FormDataValues {
  [fieldName: string]: string | File
}

export function useRequest(getAuthHeaders: () => Record<string, string>) {
  const { state } = useOpenAPIContext()
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<RequestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Synchronous mirror of `error` so callers can read the latest failure reason
  // immediately after sendRequest resolves null (state updates lag a render).
  const errorRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Origins we've already warned about sending credentials to (warn once per host).
  const warnedHostsRef = useRef<Set<string>>(new Set())

  const validateRequest = useCallback((
    route: ParsedRoute,
    params: ParamValues,
    body: string,
    contentType: string,
    formData?: FormDataValues,
  ): ValidationError[] => {
    const errors: ValidationError[] = []

    // Validate required parameters
    for (const p of route.parameters || []) {
      if (p.required && !params[p.name]?.trim()) {
        errors.push({ field: p.name, message: i18n.t("validation.paramRequired", { name: p.name }) })
      }
    }

    // Validate request body with ajv (JSON)
    if (route.requestBody && contentType === "application/json" && body.trim()) {
      try {
        const bodyObj = JSON.parse(body)
        const content = route.requestBody.content || {}
        const schema = content[contentType]?.schema || Object.values(content)[0]?.schema
        const schemaErrors = validateWithSchema(schema, bodyObj)
        for (const err of schemaErrors) {
          errors.push({ field: err.field, message: err.message })
        }
      } catch {
        // JSON parse error — not a schema validation issue
      }
    }

    // Validate formdata required fields
    if (route.requestBody && (contentType === "multipart/form-data" || contentType === "application/x-www-form-urlencoded")) {
      const content = route.requestBody.content || {}
      const schema = content[contentType]?.schema
      if (schema?.required && formData) {
        for (const key of schema.required) {
          const val = formData[key]
          if (!val || (typeof val === "string" && !val.trim())) {
            errors.push({ field: key, message: i18n.t("validation.formRequired", { name: key }) })
          }
        }
      }
    }

    return errors
  }, [])

  const sendRequest = useCallback(async (
    route: ParsedRoute,
    params: ParamValues,
    body: string,
    contentType: string,
    formData?: FormDataValues,
  ): Promise<RequestResponse | null> => {
    const baseUrl = state.baseUrl.replace(/\/$/, "")
    if (!baseUrl) {
      errorRef.current = i18n.t("validation.baseUrl")
      setError(errorRef.current)
      return null
    }

    const validationErrors = validateRequest(route, params, body, contentType, formData)
    const firstValidationError = validationErrors[0]
    if (firstValidationError) {
      errorRef.current = firstValidationError.message
      setError(errorRef.current)
      return null
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    errorRef.current = null
    setError(null)
    setResponse(null)

    let path = route.path
    const queryParams: string[] = []
    const authHeaders = getAuthHeaders()
    const headers: Record<string, string> = { ...authHeaders }

    for (const p of route.parameters || []) {
      let val = params[p.name] ?? ""
      if (val === "__empty__" || val === "__null__") val = ""
      if (!val && !p.required) continue
      if (p.in === "path") {
        path = path.replace(`{${p.name}}`, encodeURIComponent(val))
      } else if (p.in === "query") {
        if (val) queryParams.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`)
      } else if (p.in === "header") {
        // Strip CR/LF to prevent header injection from user-supplied values.
        if (val) headers[p.name] = val.replace(/[\r\n]/g, "")
      }
    }

    let url = baseUrl + path
    if (queryParams.length) url += "?" + queryParams.join("&")

    // Warn (once per host) before sending credentials to a host the spec didn't declare.
    if (Object.keys(authHeaders).length > 0) {
      const trusted = (state.spec?.servers ?? [])
        .map(s => originOf(resolveServerUrl(s)))
        .filter((o): o is string => !!o)
      const targetOrigin = originOf(url)
      if (targetOrigin && isCrossHostTarget(url, trusted) && !warnedHostsRef.current.has(targetOrigin)) {
        warnedHostsRef.current.add(targetOrigin)
        toast.warning(i18n.t("toast.credentialCrossHost", { host: targetOrigin }))
      }
    }

    const fetchOpts: RequestInit = { method: route.method.toUpperCase(), headers }

    let fetchBody: string | FormData | null = null

    if (route.requestBody) {
      if (contentType === "multipart/form-data" || contentType === "application/x-www-form-urlencoded") {
        if (contentType === "application/x-www-form-urlencoded") {
          // urlencoded can't carry files; encode only string fields honestly.
          headers["Content-Type"] = "application/x-www-form-urlencoded"
          const usp = new URLSearchParams()
          if (formData) {
            for (const [name, val] of Object.entries(formData)) {
              if (typeof val === "string" && val) usp.append(name, val)
            }
          }
          fetchBody = usp.toString()
        } else {
          const form = new FormData()
          if (formData) {
            for (const [name, val] of Object.entries(formData)) {
              if (val instanceof File) form.append(name, val)
              else if (val) form.append(name, val)
            }
          }
          fetchBody = form
        }
      } else if (body.trim()) {
        headers["Content-Type"] = contentType || "application/json"
        fetchBody = body
      }
    }

    fetchOpts.headers = headers
    if (fetchBody) fetchOpts.body = fetchBody

    // Build default curl snippet
    const bodyStr = typeof fetchBody === "string" ? fetchBody : null
    const curlCommand = await buildSnippet(
      route.method.toUpperCase(),
      url,
      headers,
      bodyStr,
    )

    const start = performance.now()
    try {
      fetchOpts.signal = controller.signal
      const res = await fetch(url, fetchOpts)
      const elapsed = Math.round(performance.now() - start)
      const respHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { respHeaders[k] = v })

      let bodyText = ""
      if (res.status === 204 || res.status === 205 || res.status === 304) {
        bodyText = ""
      } else {
        const rawText = await res.text()
        const respCt = res.headers.get("content-type") || ""
        if (respCt.includes("json") && rawText) {
          try {
            bodyText = JSON.stringify(JSON.parse(rawText), null, 2)
          } catch {
            bodyText = rawText
          }
        } else {
          bodyText = rawText
        }
      }

      const result: RequestResponse = {
        status: res.status,
        statusText: res.statusText,
        elapsed,
        headers: respHeaders,
        body: bodyText,
        curlCommand,
        requestMethod: route.method.toUpperCase(),
        requestUrl: url,
        requestHeaders: headers,
        requestBody: bodyStr,
      }
      setResponse(result)
      setLoading(false)
      return result
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return null
      }
      const elapsed = Math.round(performance.now() - start)
      const result: RequestResponse = {
        status: 0,
        statusText: "Network Error",
        elapsed,
        headers: {},
        body: (e as Error).message,
        curlCommand,
        requestMethod: route.method.toUpperCase(),
        requestUrl: url,
        requestHeaders: headers,
        requestBody: bodyStr,
      }
      setResponse(result)
      setLoading(false)
      return result
    }
  }, [state.baseUrl, state.spec?.servers, getAuthHeaders, validateRequest])

  return {
    loading,
    response,
    error,
    errorRef,
    sendRequest,
    validateRequest,
    findTokenFields,
    clearResponse: useCallback(() => { setResponse(null); setError(null) }, []),
  }
}
