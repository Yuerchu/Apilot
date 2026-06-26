import type { ParsedRoute, RequestResponse } from "@/lib/openapi/types"
import { interpolateEnvVars } from "./env-utils"

export interface RequestConfig {
  baseUrl: string
  params: Record<string, string>
  body?: string
  contentType?: string
  headers?: Record<string, string>
  envVars?: Record<string, string>
  timeout?: number
}

export async function sendRequest(
  route: ParsedRoute,
  config: RequestConfig,
): Promise<RequestResponse> {
  const baseUrl = config.baseUrl.replace(/\/$/, "")
  if (!baseUrl) throw new Error("baseUrl is required")

  const vars = config.envVars || {}
  let path = route.path
  const queryParams: string[] = []
  const headers: Record<string, string> = { ...(config.headers || {}) }

  for (const p of route.parameters || []) {
    let val = config.params[p.name] ?? ""
    if (val === "__empty__" || val === "__null__") val = ""
    val = interpolateEnvVars(val, vars)
    if (!val && !p.required) continue
    if (p.in === "path") {
      path = path.replace(`{${p.name}}`, encodeURIComponent(val))
    } else if (p.in === "query") {
      if (val) queryParams.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`)
    } else if (p.in === "header") {
      if (val) headers[p.name] = val.replace(/[\r\n]/g, "")
    }
  }

  let url = baseUrl + path
  if (queryParams.length) url += "?" + queryParams.join("&")
  url = interpolateEnvVars(url, vars)

  const fetchOpts: RequestInit = { method: route.method.toUpperCase(), headers }
  let bodyStr: string | null = null

  if (route.requestBody && config.body?.trim()) {
    const ct = config.contentType || "application/json"
    headers["Content-Type"] = ct
    bodyStr = interpolateEnvVars(config.body, vars)
    fetchOpts.body = bodyStr
  }

  fetchOpts.headers = headers

  const curlParts = [`curl -X ${route.method.toUpperCase()}`]
  for (const [k, v] of Object.entries(headers)) {
    curlParts.push(`-H '${k}: ${v}'`)
  }
  if (bodyStr) curlParts.push(`-d '${bodyStr.replace(/'/g, "'\\''")}'`)
  curlParts.push(`'${url}'`)
  const curlCommand = curlParts.join(" \\\n  ")

  const controller = new AbortController()
  const timeout = config.timeout || 30000
  const timer = setTimeout(() => controller.abort(), timeout)
  fetchOpts.signal = controller.signal

  const start = performance.now()
  try {
    const res = await fetch(url, fetchOpts)
    clearTimeout(timer)
    const elapsed = Math.round(performance.now() - start)
    const respHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { respHeaders[k] = v })

    let bodyText = ""
    if (res.status !== 204 && res.status !== 205 && res.status !== 304) {
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

    return {
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
  } catch (e) {
    clearTimeout(timer)
    const elapsed = Math.round(performance.now() - start)
    const isAbort = (e as Error).name === "AbortError"
    return {
      status: 0,
      statusText: isAbort ? "Request Timeout" : "Network Error",
      elapsed,
      headers: {},
      body: isAbort ? `Request timed out after ${timeout}ms` : (e as Error).message,
      curlCommand,
      requestMethod: route.method.toUpperCase(),
      requestUrl: url,
      requestHeaders: headers,
      requestBody: bodyStr,
    }
  }
}
