import { useTranslation } from "react-i18next"
import { Dices, X } from "lucide-react"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, getTypeStr, generateExample } from "@/lib/openapi"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface SchemaInputProps {
  schema: SchemaObject
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  required?: boolean
  nullable?: boolean
  errorClass?: string
}

function NullButton({ onChange }: { onChange: (v: string) => void }) {
  return (
    <Button variant="ghost" size="icon" className="size-8 shrink-0" type="button" onClick={() => onChange("")}>
      <X className="size-3.5" />
    </Button>
  )
}

function RandomButton({ schema, onChange }: { schema: SchemaObject; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 shrink-0"
      type="button"
      onClick={() => {
        const val = generateExample(schema)
        if (val !== null && val !== undefined) onChange(String(val))
      }}
    >
      <Dices className="size-3.5" />
      {t("tryIt.random")}
    </Button>
  )
}

export function SchemaInput({
  schema,
  value,
  onChange,
  onBlur,
  required,
  nullable,
  errorClass = "",
}: SchemaInputProps) {
  const { t } = useTranslation()
  const ps = resolveEffectiveSchema(schema)
  const isNullable = nullable ?? ps._nullable ?? false
  const ph = getTypeStr(schema) || "string"

  // Enum → Select (no random needed, just pick from list)
  if (ps.enum) {
    return (
      <div className="flex items-center gap-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder={isNullable ? "null" : t("tryIt.empty")} />
          </SelectTrigger>
          <SelectContent>
            {isNullable && <SelectItem value="__null__">null</SelectItem>}
            {!required && !isNullable && <SelectItem value="__empty__">{t("tryIt.empty")}</SelectItem>}
            {ps.enum.map(v => (
              <SelectItem key={String(v)} value={String(v)}>{String(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isNullable && value && (
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onChange("")}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    )
  }

  // Boolean → Select (no random needed)
  if (ps.type === "boolean") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={isNullable ? "null" : t("tryIt.empty")} />
        </SelectTrigger>
        <SelectContent>
          {(!required || isNullable) && (
            <SelectItem value="__empty__">{isNullable ? "null" : t("tryIt.empty")}</SelectItem>
          )}
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  // Number / Integer + random
  if (ps.type === "integer" || ps.type === "number") {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          className={cn("h-8 text-sm flex-1", errorClass)}
          step={ps.type === "integer" ? "1" : "any"}
          min={ps.minimum}
          max={ps.maximum}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={ph}
        />
        <RandomButton schema={schema} onChange={onChange} />
        {isNullable && value && <NullButton onChange={onChange} />}
      </div>
    )
  }

  // Date-time + random
  if (ps.format === "date-time") {
    return (
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <DateTimePicker value={value} onChange={onChange} mode="datetime" />
        </div>
        <RandomButton schema={schema} onChange={onChange} />
        {isNullable && value && <NullButton onChange={onChange} />}
      </div>
    )
  }

  // Date + random
  if (ps.format === "date") {
    return (
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <DateTimePicker value={value} onChange={onChange} mode="date" />
        </div>
        <RandomButton schema={schema} onChange={onChange} />
        {isNullable && value && <NullButton onChange={onChange} />}
      </div>
    )
  }

  // All other string types + random
  const inputType = ps.format === "email" ? "email"
    : (ps.format === "uri" || ps.format === "url") ? "url"
      : "text"
  const placeholder = ps.format === "uuid" ? "UUID"
    : ps.format === "email" ? "user@example.com"
      : (ps.format === "uri" || ps.format === "url") ? "https://example.com"
        : ph

  return (
    <div className="flex items-center gap-1">
      <Input
        type={inputType}
        className={cn("h-8 text-sm flex-1", errorClass)}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        minLength={ps.minLength}
        maxLength={ps.maxLength}
        pattern={ps.pattern}
      />
      <RandomButton schema={schema} onChange={onChange} />
      {isNullable && value && <NullButton onChange={onChange} />}
    </div>
  )
}
