import { useState, useMemo, useCallback, useEffect, memo } from "react"
import { useTranslation } from "react-i18next"
import { Copy, ChevronDown, ChevronRight, Key, Braces, TableProperties } from "lucide-react"
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
import { CopyButton } from "@/components/animate-ui/components/buttons/copy"
import { CodeViewer } from "@/components/editor/CodeViewer"
import type { RequestResponse, ParsedRoute } from "@/lib/openapi/types"
import { validateWithSchema } from "@/lib/validate-schema"
import type { SchemaObject } from "@/lib/openapi/types"
import { ResponseTableView } from "./ResponseTableView"
import { findTokenFields } from "@/lib/request-utils"
import { toast } from "sonner"

interface ResponsePanelProps {
  response: RequestResponse
  route?: ParsedRoute
  onApplyToken?: (token: string, fieldName: string) => void
}


function statusColorClass(status: number): string {
  if (status >= 200 && status < 300) return "bg-method-get/20 text-method-get border-method-get/30"
  if (status >= 300 && status < 400) return "bg-method-redirect/20 text-method-redirect border-method-redirect/30"
  if (status >= 400 && status < 500) return "bg-method-patch/20 text-method-patch border-method-patch/30"
  return "bg-method-delete/20 text-method-delete border-method-delete/30"
}

export const ResponsePanel = memo(function ResponsePanel({ response, route, onApplyToken }: ResponsePanelProps) {
  const { t } = useTranslation()
  const [headersOpen, setHeadersOpen] = useState(false)
  const [bodyView, setBodyView] = useState<"json" | "table">("table")
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

  const { isJson, jsonObj, tokenButtons } = useMemo(() => {
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
      for (const tk of findTokenFields(jsonObj)) {
        tokenButtons.push({ key: tk.key, value: tk.value })
      }
    }

    return { isJson, jsonObj, tokenButtons }
  }, [response.body, response.status])

  const responseSchema = useMemo(() => {
    if (!route || response.status === 0) return undefined
    const statusKey = String(response.status)
    const respDef = route.responses[statusKey] || route.responses["default"]
    if (!respDef?.content) return undefined
    const mediaType = Object.values(respDef.content)[0]
    return mediaType?.schema as SchemaObject | undefined
  }, [route, response.status])

  const schemaErrors = useMemo(() => {
    if (!isJson || !jsonObj || !responseSchema) return []
    return validateWithSchema(responseSchema, jsonObj)
  }, [isJson, jsonObj, responseSchema])


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
            <CopyButton
              variant="ghost"
              size="xs"
              content={snippetCode}
              onCopiedChange={(copied) => { if (copied) toast.success(t("toast.curlCopied")) }}
            />
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
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setHeadersOpen(!headersOpen)}
            >
              {headersOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {t("response.headers")}
            </Button>
            {headersOpen && (
              <pre className="px-3 pb-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                {headersText}
              </pre>
            )}
          </div>
        )}

        <div className="border-t">
          {isJson && (
            <div className="flex items-center gap-1 px-3 py-1 border-b bg-muted/20">
              <Button
                variant={bodyView === "table" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setBodyView("table")}
                title={t("response.tableView")}
              >
                <TableProperties className="size-3" />
                {t("response.tableView")}
              </Button>
              <Button
                variant={bodyView === "json" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setBodyView("json")}
                title="JSON"
              >
                <Braces className="size-3" />
                JSON
              </Button>
            </div>
          )}
          {bodyView === "table" && isJson && jsonObj ? (
            <ResponseTableView data={jsonObj} schema={responseSchema} />
          ) : (
            <CodeViewer
              code={response.body}
              language={isJson ? "json" : "shell"}
              maxHeight="400px"
            />
          )}
        </div>

        {schemaErrors.length > 0 && (
          <div className="border-t px-3 py-2 space-y-1">
            <div className="text-[11px] font-medium text-destructive">
              {t("response.schemaErrors", { count: schemaErrors.length })}
            </div>
            {schemaErrors.slice(0, 10).map((err, i) => (
              <div key={i} className="text-[11px] text-destructive/80 font-mono">
                <span className="text-destructive font-semibold">{err.field || "/"}</span>
                {" "}{err.message}
              </div>
            ))}
            {schemaErrors.length > 10 && (
              <div className="text-[10px] text-muted-foreground">
                +{schemaErrors.length - 10} more
              </div>
            )}
          </div>
        )}

        {isJson && schemaErrors.length === 0 && route && response.status >= 200 && response.status < 300 && (
          <div className="border-t px-3 py-1.5">
            <span className="text-[11px] text-success">{t("response.schemaValid")}</span>
          </div>
        )}

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
