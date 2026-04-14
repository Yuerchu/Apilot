import { useState, useCallback } from "react"
import i18n from "@/lib/i18n"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { buildCurl } from "@/lib/build-curl"
import type {
  ParsedRoute,
  ValidationError,
  RequestResponse,
} from "@/lib/openapi/types"

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

  const validateRequest = useCallback((
    route: ParsedRoute,
    params: ParamValues,
    body: string,
    contentType: string,
    formData?: FormDataValues,
  ): ValidationError[] => {
    const errors: ValidationError[] = []

    for (const p of route.parameters || []) {
      if (p.required && !params[p.name]?.trim()) {
        errors.push({ field: p.name, message: i18n.t("validation.paramRequired", { name: p.name }) })
      }
    }

    if (route.requestBody && contentType === "application/json" && body.trim()) {
      try {
        const bodyObj = JSON.parse(body)
        const content = route.requestBody.content || {}
        const schema = content[contentType]?.schema || Object.values(content)[0]?.schema
        if (schema?.required) {
          for (const key of schema.required) {
            if (bodyObj[key] === undefined || bodyObj[key] === null || bodyObj[key] === "") {
              errors.push({ field: key, message: i18n.t("validation.bodyRequired", { name: key }) })
            }
          }
        }
      } catch {
        // JSON parse errors are not validation errors here
      }
    }

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
      setError(i18n.t("validation.baseUrl"))
      return null
    }

    const validationErrors = validateRequest(route, params, body, contentType, formData)
    if (validationErrors.length) {
      setError(validationErrors[0].message)
      return null
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    let path = route.path
    const queryParams: string[] = []
    const headers: Record<string, string> = { ...getAuthHeaders() }

    for (const p of route.parameters || []) {
      const val = params[p.name] ?? ""
      if (!val && !p.required) continue
      if (p.in === "path") {
        path = path.replace(`{${p.name}}`, encodeURIComponent(val))
      } else if (p.in === "query") {
        if (val) queryParams.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`)
      } else if (p.in === "header") {
        if (val) headers[p.name] = val
      }
    }

    let url = baseUrl + path
    if (queryParams.length) url += "?" + queryParams.join("&")

    const fetchOpts: RequestInit = { method: route.method.toUpperCase(), headers }

    let curlContentType: string | null = null
    let fetchBody: string | FormData | null = null

    if (route.requestBody) {
      curlContentType = contentType
      if (contentType === "multipart/form-data" || contentType === "application/x-www-form-urlencoded") {
        const form = new FormData()
        if (formData) {
          for (const [name, val] of Object.entries(formData)) {
            if (val instanceof File) {
              form.append(name, val)
            } else if (val) {
              form.append(name, val)
            }
          }
        }
        if (contentType === "application/x-www-form-urlencoded") {
          headers["Content-Type"] = "application/x-www-form-urlencoded"
          fetchBody = new URLSearchParams(form as unknown as Record<string, string>).toString()
        } else {
          fetchBody = form
        }
      } else if (body.trim()) {
        headers["Content-Type"] = "application/json"
        fetchBody = body
      }
    }

    fetchOpts.headers = headers
    if (fetchBody) fetchOpts.body = fetchBody

    const curlCommand = buildCurl(
      route.method.toUpperCase(),
      url,
      headers,
      fetchBody,
      curlContentType,
    )

    const start = performance.now()
    try {
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
      }
      setResponse(result)
      setLoading(false)
      return result
    } catch (e) {
      const elapsed = Math.round(performance.now() - start)
      const result: RequestResponse = {
        status: 0,
        statusText: "Network Error",
        elapsed,
        headers: {},
        body: (e as Error).message,
        curlCommand,
      }
      setResponse(result)
      setLoading(false)
      return result
    }
  }, [state.baseUrl, getAuthHeaders, validateRequest])

  const findTokenFields = useCallback((jsonBody: string): Array<{ key: string; value: string; priority: number }> => {
    const TOKEN_KEYS_PRIO: Record<string, number> = {
      access_token: 1, accessToken: 1, token: 2, jwt: 2, bearer: 2,
      id_token: 3, auth_token: 3, authToken: 3, session_token: 4,
      api_key: 5, apiKey: 5, refresh_token: 9,
    }

    try {
      const obj = JSON.parse(jsonBody)
      if (typeof obj !== "object" || obj === null) return []

      const found: Array<{ key: string; value: string; priority: number }> = []
      const search = (o: Record<string, unknown>, path: string) => {
        for (const [k, v] of Object.entries(o)) {
          const p = path ? `${path}.${k}` : k
          if (typeof v === "string" && v.length >= 8 && k in TOKEN_KEYS_PRIO) {
            found.push({ key: p, value: v, priority: TOKEN_KEYS_PRIO[k] })
          } else if (typeof v === "object" && v && !Array.isArray(v)) {
            search(v as Record<string, unknown>, p)
          }
        }
      }
      search(obj, "")
      return found.sort((a, b) => a.priority - b.priority)
    } catch {
      return []
    }
  }, [])

  return {
    loading,
    response,
    error,
    sendRequest,
    validateRequest,
    findTokenFields,
    clearResponse: useCallback(() => { setResponse(null); setError(null) }, []),
  }
}
