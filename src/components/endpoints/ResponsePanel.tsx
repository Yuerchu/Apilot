import { useState, useMemo, useCallback } from "react"
import { Copy, ChevronDown, ChevronRight, Key } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { RequestResponse } from "@/lib/openapi/types"
import { toast } from "sonner"

interface ResponsePanelProps {
  response: RequestResponse
  onApplyToken?: (token: string, fieldName: string) => void
}

const TOKEN_KEYS_PRIO: Record<string, number> = {
  access_token: 1, accessToken: 1, token: 2, jwt: 2, bearer: 2,
  id_token: 3, auth_token: 3, authToken: 3, session_token: 4,
  api_key: 5, apiKey: 5, refresh_token: 9,
}

function findTokens(obj: Record<string, unknown>, path: string): Array<{ key: string; value: string; priority: number }> {
  const found: Array<{ key: string; value: string; priority: number }> = []
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k
    if (typeof v === "string" && v.length >= 8 && k in TOKEN_KEYS_PRIO) {
      found.push({ key: p, value: v, priority: TOKEN_KEYS_PRIO[k] })
    } else if (typeof v === "object" && v && !Array.isArray(v)) {
      found.push(...findTokens(v as Record<string, unknown>, p))
    }
  }
  return found
}

function highlightJson(str: string): string {
  return str.replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b|\b(?:true|false)\b|\bnull\b|[{}[\],:]|[^"{}[\],:\s]+/g,
    (m, strMatch?: string, colon?: string) => {
      const e = m.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      if (strMatch) {
        const eStr = strMatch.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        if (colon) return `<span class="text-sky-400">${eStr}</span>${colon}`
        return `<span class="text-emerald-400">${eStr}</span>`
      }
      if (/^-?\d/.test(m)) return `<span class="text-orange-400">${e}</span>`
      if (m === "true" || m === "false") return `<span class="text-violet-400">${e}</span>`
      if (m === "null") return `<span class="text-red-400">${e}</span>`
      return e
    }
  )
}

function statusColorClass(status: number): string {
  if (status >= 200 && status < 300) return "bg-method-get/20 text-method-get border-method-get/30"
  if (status >= 300 && status < 400) return "bg-sky-500/20 text-sky-400 border-sky-500/30"
  if (status >= 400 && status < 500) return "bg-method-patch/20 text-method-patch border-method-patch/30"
  return "bg-method-delete/20 text-method-delete border-method-delete/30"
}

export function ResponsePanel({ response, onApplyToken }: ResponsePanelProps) {
  const [headersOpen, setHeadersOpen] = useState(false)

  const { isJson, tokenButtons } = useMemo(() => {
    let isJson = false
    let jsonObj: Record<string, unknown> | null = null
    try {
      jsonObj = JSON.parse(response.body)
      isJson = true
    } catch {
      // not json
    }

    const tokenButtons: Array<{ key: string; value: string }> = []
    if (isJson && jsonObj && typeof jsonObj === "object" && response.status >= 200 && response.status < 300) {
      const tokens = findTokens(jsonObj, "").sort((a, b) => a.priority - b.priority)
      for (const t of tokens) {
        tokenButtons.push({ key: t.key, value: t.value })
      }
    }

    return { isJson, tokenButtons }
  }, [response.body, response.status])

  const copyCurl = useCallback(() => {
    navigator.clipboard.writeText(response.curlCommand).then(() => toast.success("curl 命令已复制"))
  }, [response.curlCommand])

  const copyBody = useCallback(() => {
    navigator.clipboard.writeText(response.body).then(() => toast.success("Body 已复制"))
  }, [response.body])

  const copyFull = useCallback(() => {
    let text = `HTTP ${response.status} ${response.statusText}\n`
    for (const [k, v] of Object.entries(response.headers)) text += `${k}: ${v}\n`
    text += `\n${response.body}`
    navigator.clipboard.writeText(text).then(() => toast.success("完整响应已复制"))
  }, [response])

  const headersText = Object.entries(response.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")

  return (
    <div className="space-y-2 mt-3">
      {response.curlCommand && (
        <div className="relative rounded-md bg-muted/50 border p-3 font-mono text-xs whitespace-pre-wrap overflow-auto max-h-32">
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={copyCurl}
          >
            <Copy className="size-3" />
          </Button>
          {response.curlCommand}
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2 bg-muted/30">
          <Badge
            variant="outline"
            className={cn("text-xs font-bold tabular-nums border", statusColorClass(response.status))}
          >
            {response.status} {response.statusText}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {response.elapsed}ms
          </span>
        </div>

        {headersText && (
          <div className="border-t">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
              onClick={() => setHeadersOpen(!headersOpen)}
            >
              {headersOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              Response Headers
            </button>
            {headersOpen && (
              <pre className="px-3 pb-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                {headersText}
              </pre>
            )}
          </div>
        )}

        <div className="border-t">
          <pre
            className="p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[400px] leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: isJson ? highlightJson(response.body) : response.body
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t bg-muted/20">
          {tokenButtons.map(t => (
            <Button
              key={t.key}
              variant="outline"
              size="xs"
              onClick={() => onApplyToken?.(t.value, t.key)}
              title={`${t.key}: ${t.value.substring(0, 40)}...`}
            >
              <Key className="size-3" />
              设为 Token ({t.key})
            </Button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="xs" onClick={copyBody}>
            <Copy className="size-3" />
            复制 Body
          </Button>
          <Button variant="ghost" size="xs" onClick={copyFull}>
            <Copy className="size-3" />
            复制完整响应
          </Button>
        </div>
      </div>
    </div>
  )
}
