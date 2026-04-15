import { HTTPSnippet } from "httpsnippet-lite"
import type { HarRequest } from "httpsnippet-lite"

export interface SnippetTarget {
  id: string
  label: string
  target: string
  client: string
}

export const SNIPPET_TARGETS: SnippetTarget[] = [
  { id: "shell-curl", label: "cURL", target: "shell", client: "curl" },
  { id: "shell-httpie", label: "HTTPie", target: "shell", client: "httpie" },
  { id: "shell-wget", label: "Wget", target: "shell", client: "wget" },
  { id: "python-requests", label: "Python (requests)", target: "python", client: "requests" },
  { id: "python-http", label: "Python (http.client)", target: "python", client: "python3" },
  { id: "javascript-fetch", label: "JavaScript (fetch)", target: "javascript", client: "fetch" },
  { id: "javascript-axios", label: "JavaScript (axios)", target: "javascript", client: "axios" },
  { id: "node-fetch", label: "Node.js (fetch)", target: "node", client: "fetch" },
  { id: "node-axios", label: "Node.js (axios)", target: "node", client: "axios" },
  { id: "go-native", label: "Go", target: "go", client: "native" },
  { id: "java-okhttp", label: "Java (OkHttp)", target: "java", client: "okhttp" },
  { id: "kotlin-okhttp", label: "Kotlin (OkHttp)", target: "kotlin", client: "okhttp" },
  { id: "csharp-httpclient", label: "C# (HttpClient)", target: "csharp", client: "httpclient" },
  { id: "php-guzzle", label: "PHP (Guzzle)", target: "php", client: "guzzle" },
  { id: "php-curl", label: "PHP (cURL)", target: "php", client: "curl" },
  { id: "ruby-native", label: "Ruby", target: "ruby", client: "native" },
  { id: "swift-nsurlsession", label: "Swift", target: "swift", client: "nsurlsession" },
  { id: "r-httr", label: "R (httr)", target: "r", client: "httr" },
  { id: "powershell-restmethod", label: "PowerShell", target: "powershell", client: "restmethod" },
  { id: "http-http11", label: "HTTP/1.1", target: "http", client: "http1.1" },
]

export async function buildSnippet(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string | null,
  targetId: string = "shell-curl",
): Promise<string> {
  const target = SNIPPET_TARGETS.find(t => t.id === targetId) || SNIPPET_TARGETS[0]

  const harHeaders = Object.entries(headers).map(([name, value]) => ({ name, value }))

  const har: HarRequest = {
    method: method.toUpperCase(),
    url,
    httpVersion: "HTTP/1.1",
    cookies: [],
    headers: harHeaders,
    queryString: [],
    headersSize: -1,
    bodySize: -1,
  }

  if (body) {
    const ct = headers["Content-Type"] || headers["content-type"] || "application/json"
    har.postData = {
      mimeType: ct,
      text: body,
    }
  }

  const t = target ?? SNIPPET_TARGETS[0]!
  try {
    const snippet = new HTTPSnippet(har)
    const result = await snippet.convert(
      t.target as Parameters<typeof snippet.convert>[0],
      t.client,
    )
    if (Array.isArray(result)) return result[0] || ""
    return result || ""
  } catch {
    // Fallback to simple curl
    const parts = [`curl -X ${method.toUpperCase()} '${url}'`]
    for (const [k, v] of Object.entries(headers)) {
      parts.push(`  -H '${k}: ${v}'`)
    }
    if (body) parts.push(`  -d '${body}'`)
    return parts.join(" \\\n")
  }
}
