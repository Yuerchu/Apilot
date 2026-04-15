import { useState, useMemo, useCallback, useEffect, memo } from "react"
import { useTranslation } from "react-i18next"
import { Copy, ChevronDown, ChevronRight, Key } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildSnippet, SNIPPET_TARGETS } from "@/lib/build-snippet"
import { CodeViewer } from "@/components/editor/CodeViewer"
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
    const priority = TOKEN_KEYS_PRIO[k]
    if (typeof v === "string" && v.length >= 8 && priority !== undefined) {
      found.push({ key: p, value: v, priority })
    } else if (typeof v === "object" && v && !Array.isArray(v)) {
      found.push(...findTokens(v as Record<string, unknown>, p))
    }
  }
  return found
}


function statusColorClass(status: number): string {
  if (status >= 200 && status < 300) return "bg-method-get/20 text-method-get border-method-get/30"
  if (status >= 300 && status < 400) return "bg-sky-500/20 text-sky-400 border-sky-500/30"
  if (status >= 400 && status < 500) return "bg-method-patch/20 text-method-patch border-method-patch/30"
  return "bg-method-delete/20 text-method-delete border-method-delete/30"
}

export const ResponsePanel = memo(function ResponsePanel({ response, onApplyToken }: ResponsePanelProps) {
  const { t } = useTranslation()
  const [headersOpen, setHeadersOpen] = useState(false)
  const [snippetLang, setSnippetLang] = useState("shell-curl")
  const snippetKey = useMemo(() => JSON.stringify({
    lang: snippetLang,
    method: response.requestMethod,
    url: response.requestUrl,
    headers: response.requestHeaders,
    body: response.requestBody,
  }), [snippetLang, response.requestMethod, response.requestUrl, response.requestHeaders, response.requestBody])
  const [generatedSnippet, setGeneratedSnippet] = useState<{ key: string; code: string } | null>(null)
  const snippetCode = snippetLang === "shell-curl"
    ? response.curlCommand
    : generatedSnippet?.key === snippetKey ? generatedSnippet.code : ""

  useEffect(() => {
    if (snippetLang === "shell-curl") return
    let cancelled = false
    buildSnippet(
      response.requestMethod,
      response.requestUrl,
      response.requestHeaders,
      response.requestBody,
      snippetLang,
    ).then(code => {
      if (!cancelled) setGeneratedSnippet({ key: snippetKey, code })
    })
    return () => { cancelled = true }
  }, [snippetLang, response, snippetKey])

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
      for (const tk of tokens) {
        tokenButtons.push({ key: tk.key, value: tk.value })
      }
    }

    return { isJson, tokenButtons }
  }, [response.body, response.status])

  const copySnippet = useCallback(() => {
    navigator.clipboard.writeText(snippetCode).then(() => toast.success(t("toast.curlCopied")))
  }, [snippetCode, t])

  const copyBody = useCallback(() => {
    navigator.clipboard.writeText(response.body).then(() => toast.success(t("toast.bodyCopied")))
  }, [response.body, t])

  const copyFull = useCallback(() => {
    let text = `HTTP ${response.status} ${response.statusText}\n`
    for (const [k, v] of Object.entries(response.headers)) text += `${k}: ${v}\n`
    text += `\n${response.body}`
    navigator.clipboard.writeText(text).then(() => toast.success(t("toast.fullCopied")))
  }, [response, t])

  const headersText = Object.entries(response.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")

  return (
    <div className="space-y-2 mt-3">
      {snippetCode && (
        <div className="rounded-md bg-muted/50 border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
            <Select value={snippetLang} onValueChange={setSnippetLang}>
              <SelectTrigger className="h-6 w-auto text-[11px] gap-1 border-none bg-transparent shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SNIPPET_TARGETS.map(target => (
                  <SelectItem key={target.id} value={target.id} className="text-xs">
                    {target.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={copySnippet}
            >
              <Copy className="size-3" />
            </Button>
          </div>
          <CodeViewer
            code={snippetCode}
            language={SNIPPET_TARGETS.find(s => s.id === snippetLang)?.target || "shell"}
            maxHeight="160px"
          />
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
              {t("response.headers")}
            </button>
            {headersOpen && (
              <pre className="px-3 pb-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                {headersText}
              </pre>
            )}
          </div>
        )}

        <div className="border-t">
          <CodeViewer
            code={response.body}
            language={isJson ? "json" : "shell"}
            maxHeight="400px"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t bg-muted/20">
          {tokenButtons.map(tokenItem => (
            <Button
              key={tokenItem.key}
              variant="outline"
              size="xs"
              onClick={() => onApplyToken?.(tokenItem.value, tokenItem.key)}
              title={`${tokenItem.key}: ${tokenItem.value.substring(0, 40)}...`}
            >
              <Key className="size-3" />
              {t("response.setToken", { key: tokenItem.key })}
            </Button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="xs" onClick={copyBody}>
            <Copy className="size-3" />
            {t("response.copyBody")}
          </Button>
          <Button variant="ghost" size="xs" onClick={copyFull}>
            <Copy className="size-3" />
            {t("response.copyFull")}
          </Button>
        </div>
      </div>
    </div>
  )
})
