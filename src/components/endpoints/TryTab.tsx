import { useState, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Send, Loader2, X } from "lucide-react"
import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"
import { getTypeStr, getConstraints } from "@/lib/openapi/type-str"
import { generateExample } from "@/lib/openapi/generate-example"
import { formatSchema } from "@/lib/openapi/format-schema"
import { useAuthContext } from "@/contexts/AuthContext"
import { useRequest } from "@/hooks/use-request"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResponsePanel } from "./ResponsePanel"

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
  const ps = resolveEffectiveSchema(param.schema || ({} as SchemaObject))
  const psNullable = ps._nullable || false
  const ph = getTypeStr(param.schema || ({} as SchemaObject)) || "string"
  const hasError = (touched || !!showErrors) && param.required && !value.trim()
  const errorClass = hasError ? "border-destructive focus-visible:ring-destructive/30" : ""
  const handleBlur = () => setTouched(true)
  const wrapOnChange = (v: string) => { if (!touched) setTouched(true); onChange(v) }

  const renderInput = () => {
  if (ps.enum) {
    return (
      <div className="flex items-center gap-1">
        <Select value={value} onValueChange={wrapOnChange}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder={psNullable ? "null" : t("tryIt.empty")} />
          </SelectTrigger>
          <SelectContent>
            {psNullable && <SelectItem value="__null__">null</SelectItem>}
            {!param.required && !psNullable && <SelectItem value="__empty__">{t("tryIt.empty")}</SelectItem>}
            {ps.enum.map(v => (
              <SelectItem key={String(v)} value={String(v)}>{String(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {psNullable && value && (
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onChange("")}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    )
  }

  if (ps.type === "boolean") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={psNullable ? "null" : t("tryIt.empty")} />
        </SelectTrigger>
        <SelectContent>
          {(!param.required || psNullable) && (
            <SelectItem value="__empty__">{psNullable ? "null" : t("tryIt.empty")}</SelectItem>
          )}
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (ps.type === "integer" || ps.type === "number") {
    return (
      <Input
        type="number"
        className={cn("h-8 text-sm", errorClass)}
        step={ps.type === "integer" ? "1" : "any"}
        min={ps.minimum}
        max={ps.maximum}
        value={value}
        onChange={e => wrapOnChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={ph}
      />
    )
  }

  if (ps.format === "date-time") {
    return <DateTimePicker value={value} onChange={wrapOnChange} mode="datetime" />
  }

  if (ps.format === "date") {
    return <DateTimePicker value={value} onChange={wrapOnChange} mode="date" />
  }

  if (ps.format === "uuid") {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="text"
          className={cn("h-8 text-sm flex-1", errorClass)}
          value={value}
          onChange={e => wrapOnChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="UUID"
        />
        <Button
          variant="outline"
          size="xs"
          type="button"
          onClick={() => wrapOnChange(crypto.randomUUID())}
        >
          {t("tryIt.random")}
        </Button>
      </div>
    )
  }

  const inputType = ps.format === "email" ? "email"
    : (ps.format === "uri" || ps.format === "url") ? "url"
      : "text"
  const placeholder = ps.format === "email" ? "user@example.com"
    : (ps.format === "uri" || ps.format === "url") ? "https://example.com"
      : ph

  return (
    <Input
      type={inputType}
      className={cn("h-8 text-sm", errorClass)}
      value={value}
      onChange={e => wrapOnChange(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      minLength={ps.minLength}
      maxLength={ps.maxLength}
      pattern={ps.pattern}
    />
  )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {renderInput()}
      {hasError && (
        <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const highlighted = useMemo(() => {
    return value.replace(
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
  }, [value])

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  return (
    <div className="relative rounded-md border overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 bg-muted/30 border-b">
        <span className="text-[10px] text-muted-foreground font-medium">{t("tryIt.jsonPreview")}</span>
        <span className="text-[10px] text-muted-foreground">{t("tryIt.editable")}</span>
      </div>
      <div className="relative">
        <pre
          ref={preRef}
          className="p-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[300px] leading-relaxed pointer-events-none"
          dangerouslySetInnerHTML={{ __html: highlighted }}
          aria-hidden
        />
        <textarea
          ref={textareaRef}
          className="absolute inset-0 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto bg-transparent text-transparent caret-foreground resize-none outline-none"
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

function SchemaFormFields({
  schema,
  prefix,
  path,
  values,
  onChange,
  showErrors,
}: {
  schema: SchemaObject
  prefix: string
  path: string[]
  values: Record<string, unknown>
  onChange: (fieldPath: string, value: unknown) => void
  showErrors?: boolean
}) {
  const { t } = useTranslation()
  if (!schema || (!schema.properties && schema.type !== "object")) return null
  const required = schema.required || []

  return (
    <div className="space-y-2">
      {Object.entries(schema.properties || {}).map(([key, prop]) => {
        const fieldPath = [...path, key].join(".")
        const isRequired = required.includes(key)
        const typeStr = getTypeStr(prop)
        const ep = resolveEffectiveSchema(prop)
        const isNullable = ep._nullable || false
        const constraints = getConstraints(ep)
        const desc = ep.description || prop.description

        // Get current value from nested object
        let currentVal: unknown = values
        for (const p of [...path, key]) {
          currentVal = (currentVal as Record<string, unknown>)?.[p]
        }

        const fieldEmpty = currentVal === undefined || currentVal === null || currentVal === ""
        const fieldError = isRequired && fieldEmpty && !!showErrors
        const fieldErrorClass = fieldError ? "border-destructive focus-visible:ring-destructive/30" : ""

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">{key}</span>
              <span className="text-[10px] text-muted-foreground">{typeStr}</span>
              {isRequired && <span className="text-[10px] text-destructive font-medium">{t("tryIt.required")}</span>}
              {constraints && <span className="text-[10px] text-muted-foreground">{constraints}</span>}
              {desc && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={desc}>
                  {desc}
                </span>
              )}
            </div>

            {ep.enum ? (
              <Select
                value={currentVal != null ? String(currentVal) : ""}
                onValueChange={v => onChange(fieldPath, v === "__null__" || v === "__empty__" ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={isNullable ? "null" : t("tryIt.empty")} />
                </SelectTrigger>
                <SelectContent>
                  {isNullable && <SelectItem value="__null__">null</SelectItem>}
                  {!isRequired && !isNullable && <SelectItem value="__empty__">{t("tryIt.empty")}</SelectItem>}
                  {ep.enum.map(v => (
                    <SelectItem key={String(v)} value={String(v)}>{String(v)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : ep.type === "boolean" ? (
              <button
                type="button"
                className={cn(
                  "h-6 w-10 rounded-full transition-colors relative",
                  currentVal ? "bg-primary" : "bg-muted"
                )}
                onClick={() => onChange(fieldPath, !currentVal)}
              >
                <div className={cn(
                  "size-4 rounded-full bg-white absolute top-1 transition-transform",
                  currentVal ? "translate-x-5" : "translate-x-1"
                )} />
              </button>
            ) : (ep.type === "object" || ep.properties) ? (
              <div className="ml-3 border-l-2 border-border/50 pl-3">
                <SchemaFormFields
                  schema={ep}
                  prefix={prefix}
                  path={[...path, key]}
                  values={values}
                  onChange={onChange}
                  showErrors={showErrors}
                />
              </div>
            ) : ep.type === "array" ? (
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm font-mono resize-y min-h-[60px]"
                rows={3}
                value={typeof currentVal === "string" ? currentVal : JSON.stringify(currentVal ?? [], null, 2)}
                onChange={e => {
                  try { onChange(fieldPath, JSON.parse(e.target.value)) } catch { onChange(fieldPath, e.target.value) }
                }}
              />
            ) : (ep.type === "integer" || ep.type === "number") ? (
              <Input
                type="number"
                className={cn("h-8 text-sm", fieldErrorClass)}
                step={ep.type === "integer" ? "1" : "any"}
                min={ep.minimum}
                max={ep.maximum}
                value={currentVal != null ? String(currentVal) : ""}
                onChange={e => {
                  const v = e.target.value
                  onChange(fieldPath, v === "" ? (ep.type === "integer" ? 0 : 0.0) :
                    ep.type === "integer" ? parseInt(v, 10) : parseFloat(v))
                }}
                placeholder={typeStr}
              />
            ) : ep.format === "uuid" ? (
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  className={cn("h-8 text-sm flex-1", fieldErrorClass)}
                  value={currentVal != null ? String(currentVal) : ""}
                  onChange={e => onChange(fieldPath, e.target.value)}
                  placeholder="UUID"
                />
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  onClick={() => onChange(fieldPath, crypto.randomUUID())}
                >
                  {t("tryIt.random")}
                </Button>
              </div>
            ) : ep.format === "date-time" ? (
              <DateTimePicker
                value={currentVal != null ? String(currentVal) : ""}
                onChange={v => onChange(fieldPath, v)}
                mode="datetime"
              />
            ) : ep.format === "date" ? (
              <DateTimePicker
                value={currentVal != null ? String(currentVal) : ""}
                onChange={v => onChange(fieldPath, v)}
                mode="date"
              />
            ) : (
              <Input
                type={ep.format === "email" ? "email" : (ep.format === "uri" || ep.format === "url") ? "url" : "text"}
                className={cn("h-8 text-sm", fieldErrorClass)}
                value={currentVal != null ? String(currentVal) : ""}
                onChange={e => onChange(fieldPath, e.target.value)}
                placeholder={ep.format === "email" ? "user@example.com" : (ep.format === "uri" || ep.format === "url") ? "https://example.com" : typeStr}
                minLength={ep.minLength}
                maxLength={ep.maxLength}
                pattern={ep.pattern}
              />
            )}
            {fieldError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
          </div>
        )
      })}
    </div>
  )
}

export function TryTab({ route, index }: TryTabProps) {
  const { t } = useTranslation()
  const { getAuthHeaders, applyToken } = useAuthContext()
  const { loading, response, error: requestError, sendRequest } = useRequest(getAuthHeaders)
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
  const [bodyObj, setBodyObj] = useState<Record<string, unknown>>(() => {
    try { return JSON.parse(bodyJson) } catch { return {} }
  })

  // Form data values (for multipart/urlencoded)
  const [fdValues, setFdValues] = useState<Record<string, string>>({})
  const [fdFiles, setFdFiles] = useState<Record<string, File | null>>({})

  // Body view: example vs schema
  const [bodyView, setBodyView] = useState<"example" | "schema">("example")

  // Sync form → JSON
  const syncingRef = useRef(false)

  const handleFormChange = useCallback((fieldPath: string, value: unknown) => {
    if (syncingRef.current) return
    syncingRef.current = true

    setBodyObj(prev => {
      const next = { ...prev }
      const parts = fieldPath.split(".")
      let cur: Record<string, unknown> = next
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== "object") {
          cur[parts[i]] = {}
        }
        cur[parts[i]] = { ...(cur[parts[i]] as Record<string, unknown>) }
        cur = cur[parts[i]] as Record<string, unknown>
      }
      cur[parts[parts.length - 1]] = value
      const json = JSON.stringify(next, null, 2)
      setBodyJson(json)
      return next
    })

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
    if (isFormType) {
      const formData: Record<string, string | File> = {}
      for (const [k, v] of Object.entries(fdValues)) {
        if (v) formData[k] = v
      }
      for (const [k, v] of Object.entries(fdFiles)) {
        if (v) formData[k] = v
      }
      await sendRequest(route, params, "", selectedCt, formData)
    } else {
      await sendRequest(route, params, bodyJson, selectedCt)
    }
  }, [route, params, bodyJson, selectedCt, isFormType, fdValues, fdFiles, sendRequest])

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
  const hasObjectSchema = currentSchema && (currentSchema.type === "object" || currentSchema.properties)

  return (
    <div className="space-y-4">
      {/* Parameters */}
      {route.parameters?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("tryIt.parameters")}</h4>
          <div className="space-y-2 px-0.5">
            {route.parameters.map((p, i) => (
              <div key={`${p.name}-${i}`} className="grid grid-cols-[120px_50px_1fr_auto] gap-2 items-center">
                <div className="text-sm font-medium truncate">
                  {p.name}
                  {p.required && <span className="text-destructive ml-0.5">*</span>}
                </div>
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
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                className={cn(
                  "px-2 py-0.5 text-[11px] transition-colors",
                  bodyView === "example" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setBodyView("example")}
              >
                {t("tryIt.example")}
              </button>
              <button
                type="button"
                className={cn(
                  "px-2 py-0.5 text-[11px] transition-colors",
                  bodyView === "schema" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setBodyView("schema")}
              >
                {t("tryIt.schema")}
              </button>
            </div>
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
            ) : hasObjectSchema ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 max-h-[400px] overflow-auto px-1">
                  <SchemaFormFields
                    schema={currentSchema!}
                    prefix={`bf-${index}`}
                    path={[]}
                    values={bodyObj}
                    onChange={handleFormChange}
                    showErrors={showErrors}
                  />
                </div>
                <JsonEditorPane
                  value={bodyJson}
                  onChange={handleJsonChange}
                />
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

      {/* Send button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSend} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
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
        <ResponsePanel response={response} onApplyToken={handleApplyToken} />
      )}
    </div>
  )
}
