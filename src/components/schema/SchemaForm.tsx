import { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from "react"
import { X, Check, ChevronsUpDown } from "lucide-react"
import { useForm, Controller, useFieldArray, type Control, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, getTypeStr, getConstraints, generateExample } from "@/lib/openapi"
import { validateWithSchema } from "@/lib/validate-schema"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SchemaInput } from "@/components/schema/SchemaInput"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

import { Checkbox } from "@/components/ui/checkbox"

interface ExcludedFieldsContextValue {
  excluded: Set<string>
  toggle: (fieldName: string) => void
}

const ExcludedFieldsContext = createContext<ExcludedFieldsContextValue>({
  excluded: new Set(),
  toggle: () => {},
})

function useExcludedFields() {
  return useContext(ExcludedFieldsContext)
}

type SchemaFormValues = Record<string, unknown>
type SchemaFormOutput = SchemaFormValues | unknown[]
type ArrayFieldValues = Record<string, unknown[]>

interface SchemaFormProps {
  schema: SchemaObject
  /** When true, non-required fields default to excluded (useful for PATCH) */
  defaultExcludeOptional?: boolean
  value: SchemaFormOutput
  onChange: (value: SchemaFormOutput) => void
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

export function EnumMultiSelect({
  enumValues,
  selected,
  onChange,
}: {
  enumValues: string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(selected), [selected])

  // Group by prefix (e.g. "characters:*" → "characters")
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const v of enumValues) {
      const prefix = v.includes(":") ? v.split(":")[0]! : ""
      const group = map.get(prefix) ?? []
      group.push(v)
      map.set(prefix, group)
    }
    return map
  }, [enumValues])

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(v => (
            <Badge key={v} variant="secondary" className="text-[10px] gap-1 pl-1.5 pr-1 py-0 h-5 font-mono">
              {v}
              <button
                type="button"
                className="hover:text-destructive"
                onClick={() => toggle(v)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-xs font-normal h-8"
          >
            {selected.length
              ? t("tryIt.selectedCount", { count: selected.length, defaultValue: "{{count}} selected" })
              : t("tryIt.selectValues", "Select values...")}
            <ChevronsUpDown className="size-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("tryIt.searchEnum", "Search...")} className="h-8 text-xs" />
            <CommandList className="max-h-[240px]">
              <CommandEmpty>{t("search.noResults")}</CommandEmpty>
              {groups.size <= 1 ? (
                <CommandGroup>
                  {enumValues.map(v => (
                    <CommandItem key={v} value={v} onSelect={() => toggle(v)} className="text-xs font-mono gap-2">
                      <Check className={cn("size-3", selectedSet.has(v) ? "opacity-100" : "opacity-0")} />
                      {v}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                [...groups.entries()].map(([prefix, values]) => (
                  <CommandGroup key={prefix} heading={prefix || "other"}>
                    {values.map(v => (
                      <CommandItem key={v} value={v} onSelect={() => toggle(v)} className="text-xs font-mono gap-2">
                        <Check className={cn("size-3", selectedSet.has(v) ? "opacity-100" : "opacity-0")} />
                        {v}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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

  // Array of enum — multi-select combobox
  const itemEnum = itemSchema?.enum as string[] | undefined
  if (itemEnum && itemEnum.length > 0) {
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
            const current = Array.isArray(field.value) ? field.value as string[] : []
            return (
              <EnumMultiSelect
                enumValues={itemEnum}
                selected={current}
                onChange={field.onChange}
              />
            )
          }}
        />
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
  const { excluded, toggle } = useExcludedFields()
  const effectiveProp = resolveEffectiveSchema(prop)
  const isNullable = effectiveProp._nullable || false
  const typeStr = getTypeStr(prop)
  const constraints = getConstraints(effectiveProp)
  const desc = effectiveProp.description || prop.description || ""
  const fieldName = basePath ? `${basePath}.${name}` : name
  const isExcluded = excluded.has(fieldName)

  const fieldState = form.getFieldState(fieldName, form.formState)
  const isEmpty = (() => {
    const v = form.getValues(fieldName)
    return v === undefined || v === null || v === ""
  })()
  const hasError = isRequired && isEmpty && (fieldState.isTouched || !!showErrors)
  const errorClass = hasError ? "border-destructive focus-visible:ring-destructive/30" : ""

  const fieldContent = renderFieldContent()
  if (!isRequired) {
    return (
      <div className={cn("flex gap-2", isExcluded && "opacity-40")}>
        <Checkbox
          checked={!isExcluded}
          onCheckedChange={() => toggle(fieldName)}
          className="mt-1.5 size-3.5 shrink-0"
          size="sm"
        />
        <div className={cn("flex-1 min-w-0", isExcluded && "pointer-events-none")}>{fieldContent}</div>
      </div>
    )
  }
  return fieldContent

  function renderFieldContent(): React.ReactNode {

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

  // File (binary) — special case, not a string value
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

  // All other primitive types — delegate to SchemaInput
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
          const strVal = field.value !== undefined && field.value !== null
            ? String(field.value)
            : (effectiveProp.default !== undefined ? String(effectiveProp.default) : "")
          return (
            <SchemaInput
              schema={prop}
              value={strVal}
              onChange={v => {
                // Convert back to appropriate type
                if (effectiveProp.type === "integer") field.onChange(v === "" ? null : parseInt(v, 10))
                else if (effectiveProp.type === "number") field.onChange(v === "" ? null : parseFloat(v))
                else if (effectiveProp.type === "boolean") field.onChange(v === "true" ? true : v === "false" ? false : null)
                else if (v === "__null__" || v === " ") field.onChange(null)
                else if (v === "__empty__") field.onChange(null)
                else field.onChange(v || null)
              }}
              onBlur={field.onBlur}
              required={isRequired}
              nullable={isNullable}
              errorClass={errorClass}
            />
          )
        }}
      />
      {hasError && <span className="text-[11px] text-destructive">{t("tryIt.fieldRequired")}</span>}
    </div>
  )
  } // end renderFieldContent
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

function stripExcludedFields(obj: unknown, excluded: Set<string>, prefix = ""): unknown {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return obj
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (excluded.has(path)) continue
    result[key] = typeof val === "object" && val !== null && !Array.isArray(val)
      ? stripExcludedFields(val, excluded, path)
      : val
  }
  return result
}

export function SchemaForm({ schema, value, onChange, prefix: _prefix, showErrors = false, defaultExcludeOptional = false }: SchemaFormProps) {
  if (!schema) return null

  const resolved = resolveEffectiveSchema(schema)

  // Top-level array with enum items → render EnumMultiSelect directly (no form hooks needed)
  if (resolved.type === "array" && resolved.items) {
    const itemSchema = resolveEffectiveSchema(resolved.items as SchemaObject)
    const itemEnum = itemSchema.enum as string[] | undefined
    if (itemEnum && itemEnum.length > 0) {
      const current = Array.isArray(value) ? value as string[] : []
      return (
        <EnumMultiSelect
          enumValues={itemEnum}
          selected={current}
          onChange={v => onChange(v)}
        />
      )
    }
  }

  if (!schema.properties && schema.type !== "object") {
    return null
  }

  const objectValue = Array.isArray(value) ? {} : value
  return <ObjectSchemaForm schema={schema} value={objectValue} onChange={onChange} showErrors={showErrors} defaultExcludeOptional={defaultExcludeOptional} />
}

function BulkFieldActions({
  onSelectAll,
  onSelectNone,
  onInvert,
  includedCount,
  totalCount,
}: {
  onSelectAll: () => void
  onSelectNone: () => void
  onInvert: () => void
  includedCount: number
  totalCount: number
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{t("schemaForm.fieldCount", { included: includedCount, total: totalCount })}</span>
      <div className="flex-1" />
      <Button variant="ghost" size="xs" type="button" onClick={onSelectAll}>{t("schemaForm.selectAll")}</Button>
      <Button variant="ghost" size="xs" type="button" onClick={onInvert}>{t("schemaForm.invert")}</Button>
      <Button variant="ghost" size="xs" type="button" onClick={onSelectNone}>{t("schemaForm.selectNone")}</Button>
    </div>
  )
}

function ObjectSchemaForm({ schema, value, onChange, showErrors, defaultExcludeOptional = false }: {
  schema: SchemaObject
  value: SchemaFormValues
  onChange: (value: SchemaFormOutput) => void
  showErrors: boolean
  defaultExcludeOptional?: boolean
}) {
  const form = useForm<SchemaFormValues>({
    defaultValues: value,
    resolver: customResolver(schema),
  })

  const [excluded, setExcluded] = useState<Set<string>>(() => {
    if (!defaultExcludeOptional || !schema.properties) return new Set()
    const required = new Set(schema.required || [])
    return new Set(Object.keys(schema.properties).filter(k => !required.has(k)))
  })
  const toggleExcluded = useCallback((fieldName: string) => {
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(fieldName)) next.delete(fieldName)
      else next.add(fieldName)
      return next
    })
  }, [])
  const excludedCtx = useMemo(() => ({ excluded, toggle: toggleExcluded }), [excluded, toggleExcluded])

  const syncingRef = useRef(false)
  const lastJsonRef = useRef(JSON.stringify(value))

  // Sync form changes to parent (strip excluded fields)
  useEffect(() => {
    const sub = form.watch((values) => {
      if (syncingRef.current) return
      const stripped = stripExcludedFields(values, excluded) as SchemaFormValues
      const json = JSON.stringify(stripped)
      if (json === lastJsonRef.current) return
      lastJsonRef.current = json
      onChange(stripped)
    })
    return () => sub.unsubscribe()
  }, [form, onChange, excluded])

  // Re-emit when excluded fields change
  useEffect(() => {
    if (syncingRef.current) return
    const values = form.getValues()
    const stripped = stripExcludedFields(values, excluded) as SchemaFormValues
    const json = JSON.stringify(stripped)
    if (json === lastJsonRef.current) return
    lastJsonRef.current = json
    onChange(stripped)
  }, [excluded]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const optionalFields = useMemo(() => {
    if (!schema.properties) return []
    const required = new Set(schema.required || [])
    return Object.keys(schema.properties).filter(k => !required.has(k))
  }, [schema])

  const selectAll = useCallback(() => setExcluded(new Set()), [])
  const selectNone = useCallback(() => setExcluded(new Set(optionalFields)), [optionalFields])
  const invertSelection = useCallback(() => {
    setExcluded(prev => {
      const next = new Set<string>()
      for (const f of optionalFields) {
        if (!prev.has(f)) next.add(f)
      }
      return next
    })
  }, [optionalFields])

  return (
    <ExcludedFieldsContext.Provider value={excludedCtx}>
      <div className="space-y-3">
        {optionalFields.length > 0 && (
          <BulkFieldActions
            onSelectAll={selectAll}
            onSelectNone={selectNone}
            onInvert={invertSelection}
            includedCount={optionalFields.length - optionalFields.filter(f => excluded.has(f)).length}
            totalCount={optionalFields.length}
          />
        )}
        <FormFields
          schema={schema}
          basePath=""
          form={form}
          showErrors={showErrors}
        />
      </div>
    </ExcludedFieldsContext.Provider>
  )
}
