import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Send } from "@/components/animate-ui/icons/send"
import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"
import { getTypeStr, getConstraints } from "@/lib/openapi/type-str"
import { generateExample } from "@/lib/openapi/generate-example"
import { formatSchema } from "@/lib/openapi/format-schema"
import { useAuthContext } from "@/contexts/AuthContext"
import { useRequest } from "@/hooks/use-request"
import { useHistory } from "@/hooks/use-history"
import { useEnvVars } from "@/hooks/use-env-vars"
import { interpolateEnvVars } from "@/lib/db"
import { getParsedRouteKey } from "@/lib/openapi/route-key"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { buildSnippet, SNIPPET_TARGETS } from "@/lib/build-snippet"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { SchemaInput } from "@/components/schema/SchemaInput"
import { JsonEditor } from "@/components/editor/JsonEditor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CopyButton } from "@/components/animate-ui/components/buttons/copy"
import { CodeViewer } from "@/components/editor/CodeViewer"
import { ResponsePanel } from "./ResponsePanel"
import { toast } from "sonner"

interface TryTabProps {
  route: ParsedRoute
  index: number
}

function ParameterField({
  param,
  value,
  onChange,
  showErrors,
}: {
  param: ParsedRoute["parameters"][number]
  value: string
  onChange: (v: string) => void
  showErrors?: boolean
}) {
  const { t } = useTranslation()
  const [touched, setTouched] = useState(false)
  const hasError = (touched || !!showErrors) && param.required && !value.trim()
  const errorClass = hasError ? "border-destructive focus-visible:ring-destructive/30" : ""

  return (
    <div className="relative">
      <SchemaInput
        schema={param.schema || ({ type: "string" } as SchemaObject)}
        value={value}
        onChange={v => { if (!touched) setTouched(true); onChange(v) }}
        onBlur={() => setTouched(true)}
        required={!!param.required}
        errorClass={errorClass}
      />
      {hasError && (
        <span className="absolute -bottom-4 left-0 text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>
      )}
    </div>
  )
}

function FormDataFields({
  schema,
  values,
  fileValues: _fileValues,
  onChange,
  onFileChange,
}: {
  schema: SchemaObject | undefined
  values: Record<string, string>
  fileValues: Record<string, File | null>
  onChange: (key: string, val: string) => void
  onFileChange: (key: string, file: File | null) => void
}) {
  const { t } = useTranslation()
  if (!schema?.properties) {
    return <p className="text-sm text-muted-foreground">{t("tryIt.noSchema")}</p>
  }

  const required = new Set(schema.required || [])

  return (
    <div className="space-y-3">
      {Object.entries(schema.properties).map(([key, prop]) => {
        const ep = resolveEffectiveSchema(prop)
        const isReq = required.has(key)
        const typeStr = getTypeStr(prop)

        return (
          <div key={key} className="grid grid-cols-[120px_60px_1fr] gap-2 items-center">
            <div className="text-sm font-medium truncate">
              {key}
              {isReq && <span className="text-destructive ml-0.5">*</span>}
            </div>
            <div className="text-xs text-muted-foreground">{typeStr}</div>
            <div>
              {(ep.format === "binary" || ep.format === "base64" || ep.type === "file") ? (
                <Input
                  type="file"
                  className="h-8 text-sm"
                  onChange={e => onFileChange(key, e.target.files?.[0] || null)}
                />
              ) : ep.type === "boolean" ? (
                <Select value={values[key] || ""} onValueChange={v => onChange(key, v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t("tryIt.empty")} />
                  </SelectTrigger>
                  <SelectContent>
                    {!isReq && <SelectItem value="__empty__">{t("tryIt.empty")}</SelectItem>}
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : ep.enum ? (
                <Select value={values[key] || ""} onValueChange={v => onChange(key, v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t("tryIt.empty")} />
                  </SelectTrigger>
                  <SelectContent>
                    {!isReq && <SelectItem value="__empty__">{t("tryIt.empty")}</SelectItem>}
                    {ep.enum.map(v => (
                      <SelectItem key={String(v)} value={String(v)}>{String(v)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (ep.type === "integer" || ep.type === "number") ? (
                <Input
                  type="number"
                  className="h-8 text-sm"
                  step={ep.type === "integer" ? "1" : "any"}
                  value={values[key] || ""}
                  onChange={e => onChange(key, e.target.value)}
                  placeholder={typeStr}
                />
              ) : (
                <Input
                  type="text"
                  className="h-8 text-sm"
                  value={values[key] || ""}
                  onChange={e => onChange(key, e.target.value)}
                  placeholder={typeStr}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function JsonEditorPane({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 bg-muted/30 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">{t("tryIt.jsonPreview")}</span>
        <span className="text-[10px] text-muted-foreground">{t("tryIt.editable")}</span>
      </div>
      <JsonEditor value={value} onChange={onChange} minHeight="120px" />
    </div>
  )
}

export function TryTab({ route, index: _index }: TryTabProps) {
  const { t } = useTranslation()
  const { getAuthHeaders, applyToken } = useAuthContext()
  const { loading, response, error: requestError, sendRequest } = useRequest(getAuthHeaders)
  const routeKey = getParsedRouteKey(route)
  const { addEntry } = useHistory(routeKey)
  const { state: ctxState } = useOpenAPIContext()
  const { varsMap } = useEnvVars()
  const [showErrors, setShowErrors] = useState(false)

  // Parameter values
  const [params, setParams] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of route.parameters || []) {
      const ps = resolveEffectiveSchema(p.schema || ({} as SchemaObject))
      init[p.name] = ps.default !== undefined ? String(ps.default) : ""
    }
    return init
  })

  // Request body
  const contentTypes = useMemo(() => {
    return Object.keys(route.requestBody?.content || {})
  }, [route.requestBody])
  const [selectedCt, setSelectedCt] = useState(contentTypes[0] || "application/json")
  const isFormType = selectedCt === "multipart/form-data" || selectedCt === "application/x-www-form-urlencoded"

  // JSON body
  const [bodyJson, setBodyJson] = useState(() => {
    if (!route.requestBody) return ""
    const content = route.requestBody.content || {}
    const ct = contentTypes[0] || "application/json"
    const schema = content[ct]?.schema
    if (!schema) return "{}"
    const example = generateExample(schema as SchemaObject)
    return JSON.stringify(example, null, 2)
  })

  // Body object for form sync
  const [bodyObj, setBodyObj] = useState<Record<string, unknown> | unknown[]>(() => {
    try { return JSON.parse(bodyJson) } catch { return {} }
  })

  // Form data values (for multipart/urlencoded)
  const [fdValues, setFdValues] = useState<Record<string, string>>({})
  const [fdFiles, setFdFiles] = useState<Record<string, File | null>>({})

  // Body view: example vs schema
  const [bodyView, setBodyView] = useState<"example" | "schema">("example")

  // Sync form → JSON
  const syncingRef = useRef(false)

  const handleFormChange = useCallback((newValues: Record<string, unknown> | unknown[]) => {
    if (syncingRef.current) return
    syncingRef.current = true
    setBodyObj(newValues)
    setBodyJson(JSON.stringify(newValues, null, 2))
    syncingRef.current = false
  }, [])

  const handleJsonChange = useCallback((json: string) => {
    setBodyJson(json)
    if (syncingRef.current) return
    syncingRef.current = true
    try {
      const obj = JSON.parse(json)
      setBodyObj(obj)
    } catch {
      // invalid JSON, don't sync
    }
    syncingRef.current = false
  }, [])

  const handleFdChange = useCallback((key: string, val: string) => {
    setFdValues(prev => ({ ...prev, [key]: val }))
  }, [])

  const handleFdFileChange = useCallback((key: string, file: File | null) => {
    setFdFiles(prev => ({ ...prev, [key]: file }))
  }, [])

  const handleSend = useCallback(async () => {
    setShowErrors(true)
    // Interpolate env vars into params and body
    const resolvedParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(params)) {
      resolvedParams[k] = interpolateEnvVars(v, varsMap)
    }
    const resolvedBody = interpolateEnvVars(bodyJson, varsMap)

    let result
    if (isFormType) {
      const formData: Record<string, string | File> = {}
      for (const [k, v] of Object.entries(fdValues)) {
        if (v) formData[k] = typeof v === "string" ? interpolateEnvVars(v, varsMap) : v
      }
      for (const [k, v] of Object.entries(fdFiles)) {
        if (v) formData[k] = v
      }
      result = await sendRequest(route, resolvedParams, "", selectedCt, formData)
    } else {
      result = await sendRequest(route, resolvedParams, resolvedBody, selectedCt)
    }
    if (result) {
      addEntry({
        routeKey,
        method: route.method,
        path: route.path,
        requestParams: params,
        requestBody: isFormType ? null : bodyJson,
        contentType: selectedCt,
        response: result,
      })
    }
  }, [route, routeKey, params, bodyJson, selectedCt, isFormType, fdValues, fdFiles, sendRequest, addEntry, varsMap])

  const handleApplyToken = useCallback((token: string, fieldName: string) => {
    applyToken(token, fieldName)
  }, [applyToken])

  // Content type switch → rebuild body
  const handleCtChange = useCallback((ct: string) => {
    setSelectedCt(ct)
    const content = route.requestBody?.content || {}
    const schema = content[ct]?.schema
    if (schema && ct !== "multipart/form-data" && ct !== "application/x-www-form-urlencoded") {
      const example = generateExample(schema as SchemaObject)
      const json = JSON.stringify(example, null, 2)
      setBodyJson(json)
      try { setBodyObj(JSON.parse(json)) } catch { setBodyObj({}) }
    }
  }, [route.requestBody])

  const currentSchema = route.requestBody?.content?.[selectedCt]?.schema as SchemaObject | undefined
  const resolvedBodySchema = currentSchema ? resolveEffectiveSchema(currentSchema) : undefined
  const hasObjectSchema = currentSchema && (currentSchema.type === "object" || currentSchema.properties)
  const hasArrayEnumSchema = resolvedBodySchema?.type === "array" && resolvedBodySchema.items
    && !!(resolveEffectiveSchema(resolvedBodySchema.items as SchemaObject).enum)
  const hasFormableSchema = hasObjectSchema || hasArrayEnumSchema

  // Live snippet preview
  const [snippetLang, setSnippetLang] = useState("shell-curl")
  const [liveSnippet, setLiveSnippet] = useState("")

  const liveSnippetInputs = useMemo(() => {
    const baseUrl = (ctxState.baseUrl || "").replace(/\/$/, "")
    let path = route.path
    const queryParams: string[] = []
    const headers: Record<string, string> = { ...getAuthHeaders() }

    for (const p of route.parameters || []) {
      const val = interpolateEnvVars(params[p.name] ?? "", varsMap)
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

    let bodyStr: string | null = null
    if (route.requestBody && !isFormType && bodyJson.trim()) {
      headers["Content-Type"] = "application/json"
      bodyStr = interpolateEnvVars(bodyJson, varsMap)
    }

    return { method: route.method.toUpperCase(), url, headers, bodyStr }
  }, [ctxState.baseUrl, route, params, bodyJson, isFormType, getAuthHeaders, varsMap])

  useEffect(() => {
    let cancelled = false
    buildSnippet(
      liveSnippetInputs.method,
      liveSnippetInputs.url,
      liveSnippetInputs.headers,
      liveSnippetInputs.bodyStr,
      snippetLang,
    ).then(code => {
      if (!cancelled) setLiveSnippet(code)
    })
    return () => { cancelled = true }
  }, [liveSnippetInputs, snippetLang])

  return (
    <div className="space-y-4">
      {/* Parameters */}
      {route.parameters?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("tryIt.parameters")}</h4>
          <div className="space-y-2 px-0.5">
            {route.parameters.map((p, i) => (
              <div key={`${p.name}-${i}`} className="grid grid-cols-[120px_50px_1fr_auto] gap-2 items-center mb-1">
                <label htmlFor={`param-${p.name}-${i}`} className="text-sm font-medium truncate">
                  {p.name}
                  {p.required && <span className="text-destructive ml-0.5" aria-label="required">*</span>}
                </label>
                <div className="text-xs text-muted-foreground">{p.in}</div>
                <ParameterField
                  param={p}
                  value={params[p.name] || ""}
                  onChange={v => setParams(prev => ({ ...prev, [p.name]: v }))}
                  showErrors={showErrors}
                />
                <div className="text-[10px] text-muted-foreground min-w-[60px]">
                  {getConstraints(resolveEffectiveSchema(p.schema || ({} as SchemaObject)))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Body */}
      {route.requestBody && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold">{t("tryIt.requestBody")}</h4>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={bodyView}
              onValueChange={(v) => { if (v) setBodyView(v as "example" | "schema") }}
              className="h-7"
            >
              <ToggleGroupItem value="example" className="text-[11px] px-2 h-7">
                {t("tryIt.example")}
              </ToggleGroupItem>
              <ToggleGroupItem value="schema" className="text-[11px] px-2 h-7">
                {t("tryIt.schema")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Content type selector */}
          {contentTypes.length > 1 && (
            <Select value={selectedCt} onValueChange={handleCtChange}>
              <SelectTrigger size="sm" className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contentTypes.map(ct => (
                  <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Body editor or schema view */}
          {bodyView === "example" ? (
            isFormType ? (
              <FormDataFields
                schema={currentSchema}
                values={fdValues}
                fileValues={fdFiles}
                onChange={handleFdChange}
                onFileChange={handleFdFileChange}
              />
            ) : hasFormableSchema ? (
              <div className="grid grid-cols-2 gap-3 items-start">
                <div className="space-y-2 px-1">
                  <SchemaForm
                    schema={currentSchema!}
                    value={bodyObj}
                    onChange={handleFormChange}
                    showErrors={showErrors}
                    defaultExcludeOptional={route.method === "patch"}
                  />
                </div>
                <div className="sticky top-0">
                  <JsonEditorPane
                    value={bodyJson}
                    onChange={handleJsonChange}
                  />
                </div>
              </div>
            ) : (
              <JsonEditorPane
                value={bodyJson}
                onChange={handleJsonChange}
              />
            )
          ) : (
            <pre className="rounded-md bg-muted/50 border p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[300px]">
              {currentSchema ? formatSchema(currentSchema, 0, 15) : t("tryIt.noSchema")}
            </pre>
          )}
        </div>
      )}

      {/* Live snippet preview */}
      {liveSnippet && (
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
              content={liveSnippet}
              onCopiedChange={(copied) => { if (copied) toast.success(t("toast.curlCopied")) }}
            />
          </div>
          <CodeViewer
            code={liveSnippet}
            language={SNIPPET_TARGETS.find(s => s.id === snippetLang)?.target || "shell"}
            maxHeight="160px"
          />
        </div>
      )}

      {/* Send button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSend} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send size={16} animateOnTap />
          )}
          {t("tryIt.send")}
        </Button>
        {loading && (
          <span className="text-xs text-muted-foreground">{t("tryIt.sending")}</span>
        )}
      </div>

      {/* Non-validation errors (e.g. base URL missing, network) */}
      {requestError && !requestError.includes(t("tryIt.required")) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {requestError}
        </div>
      )}

      {/* Response */}
      {response && (
        <ResponsePanel response={response} route={route} onApplyToken={handleApplyToken} />
      )}
    </div>
  )
}
