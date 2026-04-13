import { useState, useCallback, useRef, useMemo } from "react"
import { Send, Loader2 } from "lucide-react"
import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"
import { getTypeStr, getConstraints } from "@/lib/openapi/type-str"
import { generateExample } from "@/lib/openapi/generate-example"
import { formatSchema } from "@/lib/openapi/format-schema"
import { useAuth } from "@/hooks/use-auth"
import { useRequest } from "@/hooks/use-request"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
}: {
  param: ParsedRoute["parameters"][number]
  value: string
  onChange: (v: string) => void
}) {
  const ps = resolveEffectiveSchema(param.schema || ({} as SchemaObject))
  const psNullable = ps._nullable || false
  const ph = getTypeStr(param.schema || ({} as SchemaObject)) || "string"

  if (ps.enum) {
    return (
      <div className="flex items-center gap-1">
        <select
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          {psNullable && <option value="">null</option>}
          {!param.required && !psNullable && <option value="">(空)</option>}
          {ps.enum.map(v => (
            <option key={String(v)} value={String(v)}>{String(v)}</option>
          ))}
        </select>
        {psNullable && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={() => onChange("")}
            title="清除为 null"
          >
            x
          </button>
        )}
      </div>
    )
  }

  if (ps.type === "boolean") {
    return (
      <select
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {(!param.required || psNullable) && (
          <option value="">{psNullable ? "null" : "(空)"}</option>
        )}
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (ps.type === "integer" || ps.type === "number") {
    return (
      <Input
        type="number"
        className="h-8 text-sm"
        step={ps.type === "integer" ? "1" : "any"}
        min={ps.minimum}
        max={ps.maximum}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
      />
    )
  }

  if (ps.format === "date-time") {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="datetime-local"
          className="h-8 text-sm flex-1"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground px-1"
          onClick={() => onChange("")}
          title="清除"
        >
          x
        </button>
      </div>
    )
  }

  if (ps.format === "date") {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="date"
          className="h-8 text-sm flex-1"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground px-1"
          onClick={() => onChange("")}
          title="清除"
        >
          x
        </button>
      </div>
    )
  }

  if (ps.format === "uuid") {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="text"
          className="h-8 text-sm flex-1"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="UUID"
        />
        <Button
          variant="outline"
          size="xs"
          type="button"
          onClick={() => onChange(crypto.randomUUID())}
        >
          随机
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
      className="h-8 text-sm"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      minLength={ps.minLength}
      maxLength={ps.maxLength}
      pattern={ps.pattern}
    />
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
  if (!schema?.properties) {
    return <p className="text-sm text-muted-foreground">无 Schema 定义</p>
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
                <select
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={values[key] || ""}
                  onChange={e => onChange(key, e.target.value)}
                >
                  {!isReq && <option value="">(空)</option>}
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : ep.enum ? (
                <select
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={values[key] || ""}
                  onChange={e => onChange(key, e.target.value)}
                >
                  {!isReq && <option value="">(空)</option>}
                  {ep.enum.map(v => (
                    <option key={String(v)} value={String(v)}>{String(v)}</option>
                  ))}
                </select>
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
        <span className="text-[10px] text-muted-foreground font-medium">JSON 预览</span>
        <span className="text-[10px] text-muted-foreground">可直接编辑</span>
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
}: {
  schema: SchemaObject
  prefix: string
  path: string[]
  values: Record<string, unknown>
  onChange: (fieldPath: string, value: unknown) => void
}) {
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

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">{key}</span>
              <span className="text-[10px] text-muted-foreground">{typeStr}</span>
              {isRequired && <span className="text-[10px] text-destructive font-medium">必填</span>}
              {constraints && <span className="text-[10px] text-muted-foreground">{constraints}</span>}
              {desc && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={desc}>
                  {desc}
                </span>
              )}
            </div>

            {ep.enum ? (
              <select
                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={currentVal != null ? String(currentVal) : ""}
                onChange={e => {
                  const v = e.target.value
                  onChange(fieldPath, v === "" ? null : v)
                }}
              >
                {isNullable && <option value="">null</option>}
                {!isRequired && !isNullable && <option value="">(空)</option>}
                {ep.enum.map(v => (
                  <option key={String(v)} value={String(v)}>{String(v)}</option>
                ))}
              </select>
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
                className="h-8 text-sm"
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
                  className="h-8 text-sm flex-1"
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
                  随机
                </Button>
              </div>
            ) : (
              <Input
                type={ep.format === "email" ? "email" : (ep.format === "uri" || ep.format === "url") ? "url" : ep.format === "date-time" ? "datetime-local" : ep.format === "date" ? "date" : "text"}
                className="h-8 text-sm"
                value={currentVal != null ? String(currentVal) : ""}
                onChange={e => onChange(fieldPath, e.target.value)}
                placeholder={ep.format === "email" ? "user@example.com" : (ep.format === "uri" || ep.format === "url") ? "https://example.com" : typeStr}
                minLength={ep.minLength}
                maxLength={ep.maxLength}
                pattern={ep.pattern}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TryTab({ route, index }: TryTabProps) {
  const { getAuthHeaders, applyToken } = useAuth()
  const { loading, response, sendRequest } = useRequest(getAuthHeaders)

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
          <h4 className="text-sm font-semibold">Parameters</h4>
          <div className="space-y-2">
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
            <h4 className="text-sm font-semibold">Request Body</h4>
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                className={cn(
                  "px-2 py-0.5 text-[11px] transition-colors",
                  bodyView === "example" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setBodyView("example")}
              >
                示例
              </button>
              <button
                type="button"
                className={cn(
                  "px-2 py-0.5 text-[11px] transition-colors",
                  bodyView === "schema" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setBodyView("schema")}
              >
                Schema
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
                <div className="space-y-2 max-h-[400px] overflow-auto pr-1">
                  <SchemaFormFields
                    schema={currentSchema!}
                    prefix={`bf-${index}`}
                    path={[]}
                    values={bodyObj}
                    onChange={handleFormChange}
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
              {currentSchema ? formatSchema(currentSchema, 0, 15) : "(no schema)"}
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
          发送请求
        </Button>
        {loading && (
          <span className="text-xs text-muted-foreground">请求中...</span>
        )}
      </div>

      {/* Response */}
      {response && (
        <ResponsePanel response={response} onApplyToken={handleApplyToken} />
      )}
    </div>
  )
}
