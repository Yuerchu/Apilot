import { useState, useCallback } from "react"
import i18n from "@/lib/i18n"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { buildSnippet } from "@/lib/build-snippet"
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
      setError(i18n.t("validation.baseUrl"))
      return null
    }

    const validationErrors = validateRequest(route, params, body, contentType, formData)
    const firstValidationError = validationErrors[0]
    if (firstValidationError) {
      setError(firstValidationError.message)
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

    let fetchBody: string | FormData | null = null

    if (route.requestBody) {
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
  }, [state.baseUrl, getAuthHeaders, validateRequest])

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
