import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, getTypeStr, getConstraints, generateExample } from "@/lib/openapi"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SchemaFormProps {
  schema: SchemaObject
  value: Record<string, any>
  onChange: (value: Record<string, any>) => void
  prefix?: string
  showErrors?: boolean
}

function setNestedValue(
  obj: Record<string, any>,
  path: string[],
  val: unknown,
): Record<string, any> {
  const result = { ...obj }
  let cur: Record<string, any> = result
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] === undefined || typeof cur[path[i]] !== "object") {
      cur[path[i]] = {}
    } else {
      cur[path[i]] = { ...cur[path[i]] }
    }
    cur = cur[path[i]]
  }
  cur[path[path.length - 1]] = val
  return result
}

function getNestedValue(obj: Record<string, any>, path: string[]): unknown {
  let cur: unknown = obj
  for (const p of path) {
    if (cur === undefined || cur === null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function FieldLabel({
  name,
  typeStr,
  isRequired,
  constraints,
  description,
}: {
  name: string
  typeStr: string
  isRequired: boolean
  constraints: string
  description: string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1">
      <span className="font-mono text-xs font-medium text-foreground">{name}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
        {typeStr}
      </Badge>
      {isRequired && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-normal">
          {t("tryIt.required")}
        </Badge>
      )}
      {constraints && (
        <span className="text-[10px] text-muted-foreground">{constraints.trim()}</span>
      )}
      {description && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[300px]" title={description}>
          {description}
        </span>
      )}
    </div>
  )
}

function FormField({
  name,
  prop,
  isRequired,
  path,
  value,
  onFieldChange,
  showErrors,
}: {
  name: string
  prop: SchemaObject
  isRequired: boolean
  path: string[]
  value: Record<string, any>
  onFieldChange: (path: string[], val: unknown) => void
  showErrors?: boolean
}) {
  const { t } = useTranslation()
  const [touched, setTouched] = useState(false)
  const effectiveProp = resolveEffectiveSchema(prop)
  const isNullable = effectiveProp._nullable || false
  const typeStr = getTypeStr(prop)
  const constraints = getConstraints(effectiveProp)
  const desc = effectiveProp.description || prop.description || ""
  const fieldPath = [...path, name]
  const fieldValue = getNestedValue(value, fieldPath)
  const isEmpty = fieldValue === undefined || fieldValue === null || fieldValue === ""
  const hasError = isRequired && isEmpty && (touched || !!showErrors)
  const errorClass = hasError ? "border-destructive focus-visible:ring-destructive/30" : ""
  const handleBlur = () => setTouched(true)
  const handleChange = (p: string[], v: unknown) => { if (!touched) setTouched(true); onFieldChange(p, v) }

  // Enum
  if (effectiveProp.enum) {
    const currentVal = fieldValue !== undefined ? String(fieldValue) : ""
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <div className="flex items-center gap-2">
          <Select
            value={currentVal}
            onValueChange={(v) => {
              onFieldChange(fieldPath, v === "" ? null : v)
            }}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder={isNullable ? "null" : t("tryIt.empty")} />
            </SelectTrigger>
            <SelectContent>
              {(isNullable || !isRequired) && (
                <SelectItem value=" ">{isNullable ? "null" : t("tryIt.empty")}</SelectItem>
              )}
              {effectiveProp.enum.map((v) => (
                <SelectItem key={String(v)} value={String(v)}>
                  {String(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isNullable && (
            <button
              type="button"
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => handleChange(fieldPath, null)}
            >
              ✕
            </button>
          )}
        </div>
        {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
      </div>
    )
  }

  // Boolean
  if (effectiveProp.type === "boolean") {
    const checked = fieldValue === true
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={checked}
            onCheckedChange={(v) => onFieldChange(fieldPath, v)}
          />
          <span className="text-xs text-muted-foreground">{String(checked)}</span>
        </div>
      </div>
    )
  }

  // Nested object
  if (effectiveProp.type === "object" || effectiveProp.properties) {
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <div className="ml-3 pl-3 border-l-2 border-border/50 space-y-3">
          <FormFields
            schema={effectiveProp}
            path={fieldPath}
            value={value}
            onFieldChange={onFieldChange}
          />
        </div>
      </div>
    )
  }

  // Array
  if (effectiveProp.type === "array") {
    const example = generateExample(effectiveProp)
    const currentVal = fieldValue !== undefined
      ? (typeof fieldValue === "string" ? fieldValue : JSON.stringify(fieldValue, null, 2))
      : JSON.stringify(example, null, 2)
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <textarea
          className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          rows={3}
          value={currentVal}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              onFieldChange(fieldPath, parsed)
            } catch {
              onFieldChange(fieldPath, e.target.value)
            }
          }}
        />
      </div>
    )
  }

  // Integer / Number
  if (effectiveProp.type === "integer" || effectiveProp.type === "number") {
    const def = fieldValue !== undefined
      ? fieldValue
      : (effectiveProp.default !== undefined
        ? effectiveProp.default
        : (effectiveProp.minimum !== undefined ? effectiveProp.minimum : ""))
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <Input
          type="number"
          className={cn("h-8 text-xs font-mono", errorClass)}
          value={def !== null && def !== undefined ? String(def) : ""}
          step={effectiveProp.type === "integer" ? "1" : "any"}
          min={effectiveProp.minimum}
          max={effectiveProp.maximum}
          placeholder={typeStr}
          onBlur={handleBlur}
          onChange={(e) => {
            if (!touched) setTouched(true)
            const raw = e.target.value
            if (raw === "") {
              handleChange(fieldPath, null)
            } else {
              handleChange(
                fieldPath,
                effectiveProp.type === "integer" ? parseInt(raw, 10) : parseFloat(raw),
              )
            }
          }}
        />
        {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
      </div>
    )
  }

  // File (binary)
  if (effectiveProp.format === "binary") {
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <Input
          type="file"
          className="h-8 text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            onFieldChange(fieldPath, file)
          }}
        />
      </div>
    )
  }

  // String types (default)
  const fmt = effectiveProp.format
  let inputType = "text"
  if (fmt === "email") inputType = "email"
  else if (fmt === "uri" || fmt === "url") inputType = "url"
  else if (fmt === "date") inputType = "date"
  else if (fmt === "date-time") inputType = "datetime-local"

  let placeholder = typeStr
  if (fmt === "uuid") placeholder = "UUID"
  else if (fmt === "email") placeholder = "user@example.com"
  else if (fmt === "uri" || fmt === "url") placeholder = "https://example.com"

  const currentStrVal = fieldValue !== undefined
    ? String(fieldValue)
    : (effectiveProp.default !== undefined ? String(effectiveProp.default) : "")

  // UUID with random button
  if (fmt === "uuid") {
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <div className="flex items-center gap-2">
          <Input
            type="text"
            className={cn("h-8 text-xs font-mono flex-1", errorClass)}
            value={currentStrVal}
            placeholder={placeholder}
            minLength={effectiveProp.minLength}
            maxLength={effectiveProp.maxLength}
            pattern={effectiveProp.pattern}
            onChange={(e) => handleChange(fieldPath, e.target.value)}
            onBlur={handleBlur}
          />
          <button
            type="button"
            className="shrink-0 h-8 px-2.5 rounded-md border border-input bg-muted/50 text-xs hover:bg-muted transition-colors"
            onClick={() => handleChange(fieldPath, crypto.randomUUID())}
          >
            {t("tryIt.random")}
          </button>
        </div>
        {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
      </div>
    )
  }

  // Date/datetime picker
  if (fmt === "date-time" || fmt === "date") {
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <DateTimePicker
          value={currentStrVal}
          onChange={(v) => handleChange(fieldPath, v)}
          mode={fmt === "date" ? "date" : "datetime"}
        />
        {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
      </div>
    )
  }

  // Default string input
  return (
    <div className="space-y-1">
      <FieldLabel
        name={name}
        typeStr={typeStr}
        isRequired={isRequired}
        constraints={constraints}
        description={desc}
      />
      <Input
        type={inputType}
        className={cn("h-8 text-xs font-mono", errorClass)}
        value={currentStrVal}
        placeholder={placeholder}
        minLength={effectiveProp.minLength}
        maxLength={effectiveProp.maxLength}
        pattern={effectiveProp.pattern}
        onChange={(e) => handleChange(fieldPath, e.target.value)}
        onBlur={handleBlur}
      />
      {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
    </div>
  )
}

function FormFields({
  schema,
  path,
  value,
  onFieldChange,
  showErrors,
}: {
  schema: SchemaObject
  path: string[]
  value: Record<string, any>
  onFieldChange: (path: string[], val: unknown) => void
  showErrors?: boolean
}) {
  if (!schema.properties) return null
  const required = new Set(schema.required || [])

  return (
    <>
      {Object.entries(schema.properties).map(([key, prop]) => (
        <FormField
          key={key}
          name={key}
          prop={prop}
          isRequired={required.has(key)}
          path={path}
          value={value}
          onFieldChange={onFieldChange}
          showErrors={showErrors}
        />
      ))}
    </>
  )
}

export function SchemaForm({ schema, value, onChange, prefix: _prefix, showErrors }: SchemaFormProps) {
  const onFieldChange = useCallback(
    (path: string[], val: unknown) => {
      onChange(setNestedValue(value, path, val))
    },
    [value, onChange],
  )

  if (!schema || (!schema.properties && schema.type !== "object")) {
    return null
  }

  return (
    <div className="space-y-3">
      <FormFields
        schema={schema}
        path={[]}
        value={value}
        onFieldChange={onFieldChange}
        showErrors={showErrors}
      />
    </div>
  )
}
