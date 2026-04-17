import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { useForm, Controller, useFieldArray, type Control, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, getTypeStr, getConstraints, generateExample } from "@/lib/openapi"
import { validateWithSchema } from "@/lib/validate-schema"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SchemaFormValues = Record<string, unknown>
type ArrayFieldValues = Record<string, unknown[]>

interface SchemaFormProps {
  schema: SchemaObject
  value: SchemaFormValues
  onChange: (value: SchemaFormValues) => void
  prefix?: string
  showErrors?: boolean
}

function customResolver(schema: SchemaObject) {
  return async (values: SchemaFormValues) => {
    const errors = validateWithSchema(schema, values)
    if (!errors.length) return { values, errors: {} }
    const fieldErrors: Record<string, { message: string; type: string }> = {}
    for (const err of errors) {
      if (err.field) fieldErrors[err.field] = { message: err.message, type: "validate" }
    }
    return { values: {}, errors: fieldErrors }
  }
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

function ArrayField({
  name,
  basePath,
  prop,
  isRequired,
  form,
  showErrors,
}: {
  name: string
  basePath: string
  prop: SchemaObject
  isRequired: boolean
  form: UseFormReturn<SchemaFormValues>
  showErrors: boolean
}) {
  const { t } = useTranslation()
  const effectiveProp = resolveEffectiveSchema(prop)
  const typeStr = getTypeStr(prop)
  const constraints = getConstraints(effectiveProp)
  const desc = effectiveProp.description || prop.description || ""
  const fieldName = basePath ? `${basePath}.${name}` : name
  const itemSchema = effectiveProp.items ? resolveEffectiveSchema(effectiveProp.items as SchemaObject) : null
  const isObjectItems = itemSchema && (itemSchema.type === "object" || itemSchema.properties)

  const { fields, append, remove } = useFieldArray({
    control: form.control as unknown as Control<ArrayFieldValues>,
    name: fieldName as never,
  })

  if (isObjectItems) {
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
          {fields.map((field, index) => (
            <div key={field.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">[{index}]</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive"
                  onClick={() => remove(index)}
                >
                  {t("tryIt.remove", "Remove")}
                </Button>
              </div>
              <div className="ml-3 pl-3 border-l-2 border-border/50 space-y-3">
                <FormFields
                  schema={itemSchema}
                  basePath={`${fieldName}.${index}`}
                  form={form}
                  showErrors={showErrors}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const example = generateExample(itemSchema)
              append(example ?? {})
            }}
          >
            {t("tryIt.addItem", "Add item")}
          </Button>
        </div>
      </div>
    )
  }

  // Primitive array items — use a JSON textarea as fallback
  const example = generateExample(effectiveProp)
  return (
    <div className="space-y-1">
      <FieldLabel
        name={name}
        typeStr={typeStr}
        isRequired={isRequired}
        constraints={constraints}
        description={desc}
      />
      <Controller
        name={fieldName}
        control={form.control}
        render={({ field }) => {
          const currentVal = field.value !== undefined
            ? (typeof field.value === "string" ? field.value : JSON.stringify(field.value, null, 2))
            : JSON.stringify(example, null, 2)
          return (
            <Textarea
              className="min-h-[60px] text-xs font-mono"
              rows={3}
              value={currentVal}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  field.onChange(parsed)
                } catch {
                  field.onChange(e.target.value)
                }
              }}
              onBlur={field.onBlur}
            />
          )
        }}
      />
    </div>
  )
}

function FormField({
  name,
  prop,
  isRequired,
  basePath,
  form,
  showErrors,
}: {
  name: string
  prop: SchemaObject
  isRequired: boolean
  basePath: string
  form: UseFormReturn<SchemaFormValues>
  showErrors: boolean
}) {
  const { t } = useTranslation()
  const effectiveProp = resolveEffectiveSchema(prop)
  const isNullable = effectiveProp._nullable || false
  const typeStr = getTypeStr(prop)
  const constraints = getConstraints(effectiveProp)
  const desc = effectiveProp.description || prop.description || ""
  const fieldName = basePath ? `${basePath}.${name}` : name

  const fieldState = form.getFieldState(fieldName, form.formState)
  const isEmpty = (() => {
    const v = form.getValues(fieldName)
    return v === undefined || v === null || v === ""
  })()
  const hasError = isRequired && isEmpty && (fieldState.isTouched || !!showErrors)
  const errorClass = hasError ? "border-destructive focus-visible:ring-destructive/30" : ""

  // Enum
  if (effectiveProp.enum) {
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
          <Controller
            name={fieldName}
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value !== undefined ? String(field.value) : ""}
                onValueChange={(v) => {
                  field.onChange(v === "" || v === " " ? null : v)
                }}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder={isNullable ? "null" : t("tryIt.empty")} />
                </SelectTrigger>
                <SelectContent>
                  {(isNullable || !isRequired) && (
                    <SelectItem value=" ">{isNullable ? "null" : t("tryIt.empty")}</SelectItem>
                  )}
                  {effectiveProp.enum!.map((v) => (
                    <SelectItem key={String(v)} value={String(v)}>
                      {String(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {isNullable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => form.setValue(fieldName, null, { shouldTouch: true })}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
        {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
      </div>
    )
  }

  // Boolean
  if (effectiveProp.type === "boolean") {
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <Controller
          name={fieldName}
          control={form.control}
          render={({ field }) => {
            const checked = field.value === true
            return (
              <div className="flex items-center gap-2">
                <Switch
                  size="sm"
                  checked={checked}
                  onCheckedChange={(v) => field.onChange(v)}
                />
                <span className="text-xs text-muted-foreground">{String(checked)}</span>
              </div>
            )
          }}
        />
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
            basePath={fieldName}
            form={form}
            showErrors={showErrors}
          />
        </div>
      </div>
    )
  }

  // Array
  if (effectiveProp.type === "array") {
    return (
      <ArrayField
        name={name}
        basePath={basePath}
        prop={prop}
        isRequired={isRequired}
        form={form}
        showErrors={showErrors}
      />
    )
  }

  // Integer / Number
  if (effectiveProp.type === "integer" || effectiveProp.type === "number") {
    return (
      <div className="space-y-1">
        <FieldLabel
          name={name}
          typeStr={typeStr}
          isRequired={isRequired}
          constraints={constraints}
          description={desc}
        />
        <Controller
          name={fieldName}
          control={form.control}
          render={({ field }) => {
            const def = field.value !== undefined
              ? field.value
              : (effectiveProp.default !== undefined
                ? effectiveProp.default
                : (effectiveProp.minimum !== undefined ? effectiveProp.minimum : ""))
            return (
              <Input
                type="number"
                className={cn("h-8 text-xs font-mono", errorClass)}
                value={def !== null && def !== undefined ? String(def) : ""}
                step={effectiveProp.type === "integer" ? "1" : "any"}
                min={effectiveProp.minimum}
                max={effectiveProp.maximum}
                placeholder={typeStr}
                onBlur={field.onBlur}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === "") {
                    field.onChange(null)
                  } else {
                    field.onChange(
                      effectiveProp.type === "integer" ? parseInt(raw, 10) : parseFloat(raw),
                    )
                  }
                }}
              />
            )
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
        <Controller
          name={fieldName}
          control={form.control}
          render={({ field }) => (
            <Input
              type="file"
              className="h-8 text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                field.onChange(file)
              }}
            />
          )}
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
            value={String(form.getValues(fieldName) ?? (effectiveProp.default !== undefined ? effectiveProp.default : ""))}
            placeholder={placeholder}
            minLength={effectiveProp.minLength}
            maxLength={effectiveProp.maxLength}
            pattern={effectiveProp.pattern}
            {...form.register(fieldName)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => form.setValue(fieldName, crypto.randomUUID(), { shouldTouch: true })}
          >
            {t("tryIt.random")}
          </Button>
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
        <Controller
          name={fieldName}
          control={form.control}
          render={({ field }) => (
            <DateTimePicker
              value={field.value !== undefined ? String(field.value) : (effectiveProp.default !== undefined ? String(effectiveProp.default) : "")}
              onChange={(v) => field.onChange(v)}
              mode={fmt === "date" ? "date" : "datetime"}
            />
          )}
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
        placeholder={placeholder}
        minLength={effectiveProp.minLength}
        maxLength={effectiveProp.maxLength}
        pattern={effectiveProp.pattern}
        defaultValue={effectiveProp.default !== undefined ? String(effectiveProp.default) : ""}
        {...form.register(fieldName)}
      />
      {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
    </div>
  )
}

function FormFields({
  schema,
  basePath,
  form,
  showErrors,
}: {
  schema: SchemaObject
  basePath: string
  form: UseFormReturn<SchemaFormValues>
  showErrors: boolean
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
          basePath={basePath}
          form={form}
          showErrors={showErrors}
        />
      ))}
    </>
  )
}

export function SchemaForm({ schema, value, onChange, prefix: _prefix, showErrors = false }: SchemaFormProps) {
  const form = useForm<SchemaFormValues>({
    defaultValues: value,
    resolver: customResolver(schema),
  })

  const syncingRef = useRef(false)
  const lastJsonRef = useRef(JSON.stringify(value))

  // Sync form changes to parent
  useEffect(() => {
    const sub = form.watch((values) => {
      if (syncingRef.current) return
      const json = JSON.stringify(values)
      if (json === lastJsonRef.current) return
      lastJsonRef.current = json
      onChange(values as SchemaFormValues)
    })
    return () => sub.unsubscribe()
  }, [form, onChange])

  // Reset form when external value changes (e.g. from JSON editor)
  useEffect(() => {
    const json = JSON.stringify(value)
    if (json === lastJsonRef.current) return
    lastJsonRef.current = json
    syncingRef.current = true
    form.reset(value, { keepTouched: true })
    syncingRef.current = false
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger validation when showErrors becomes true
  useEffect(() => {
    if (showErrors) form.trigger()
  }, [showErrors, form])

  if (!schema || (!schema.properties && schema.type !== "object")) {
    return null
  }

  return (
    <div className="space-y-3">
      <FormFields
        schema={schema}
        basePath=""
        form={form}
        showErrors={showErrors}
      />
    </div>
  )
}
