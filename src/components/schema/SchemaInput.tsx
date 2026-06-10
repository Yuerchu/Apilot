import { useTranslation } from "react-i18next"
import { Dices, X, ChevronDown } from "lucide-react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, getTypeStr, generateExample } from "@/lib/openapi"
import { getRandomVariants, generateWithVariant } from "@/lib/openapi/generate-example"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Button } from "@/components/ui/button"
import { PhoneInput } from "@/components/schema/PhoneInput"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function detectOtpLength(schema: SchemaObject): number | null {
  const ps = resolveEffectiveSchema(schema)
  const type = Array.isArray(ps.type) ? ps.type[0] : ps.type

  if (type === "string" || !type) {
    if (!ps.pattern) return null
    const exact = ps.pattern.match(/^\^(?:\\d|\[0-9\])\{(\d+)\}\$$/)
    if (exact) {
      const len = parseInt(exact[1]!, 10)
      return len <= 8 ? len : null
    }
    const range = ps.pattern.match(/^\^(?:\\d|\[0-9\])\{(\d+),(\d+)\}\$$/)
    if (range) {
      const max = parseInt(range[2]!, 10)
      return max <= 8 ? max : null
    }
    return null
  }

  if (type === "integer") {
    const max = ps.maximum
    if (max === undefined || max < 0) return null
    const str = (max + 1).toString()
    if (/^10+$/.test(str)) {
      const digits = str.length - 1
      if (digits >= 2 && digits <= 8) return digits
    }
    return null
  }

  return null
}

function isPhoneFormat(schema: SchemaObject): boolean {
  const ps = resolveEffectiveSchema(schema)
  const fmt = ps.format
  return fmt === "phone" || fmt === "telephone" || fmt === "mobile" || fmt === "e164" || fmt === "e.164"
}

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
  const variants = getRandomVariants(schema)

  const handleDefault = () => {
    const val = generateExample(schema)
    if (val !== null && val !== undefined) onChange(String(val))
  }

  const handleVariant = (variantId: string) => {
    const val = generateWithVariant(schema, variantId)
    if (val !== null && val !== undefined) onChange(String(val))
  }

  if (variants.length === 0) {
    return (
      <Button variant="outline" size="sm" className="h-8 shrink-0" type="button" onClick={handleDefault}>
        <Dices className="size-3.5" />
        {t("tryIt.random")}
      </Button>
    )
  }

  return (
    <div className="flex shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-r-none border-r-0"
        type="button"
        onClick={handleDefault}
      >
        <Dices className="size-3.5" />
        {t("tryIt.random")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-1.5 rounded-l-none" type="button">
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          {variants.map(v => (
            <DropdownMenuItem key={v.id} onClick={() => handleVariant(v.id)} className="text-xs">
              {v.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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

  // Phone format → specialized phone input with country picker
  if (isPhoneFormat(schema)) {
    return (
      <PhoneInput
        schema={schema}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        nullable={isNullable}
        errorClass={errorClass}
      />
    )
  }

  // OTP-like field (short digit-only pattern or integer code range)
  const otpLen = detectOtpLength(schema)
  if (otpLen) {
    const groups: number[][] = []
    if (otpLen <= 4) {
      groups.push(Array.from({ length: otpLen }, (_, i) => i))
    } else {
      const half = Math.ceil(otpLen / 2)
      groups.push(Array.from({ length: half }, (_, i) => i))
      groups.push(Array.from({ length: otpLen - half }, (_, i) => i + half))
    }
    return (
      <div className="flex items-center gap-1">
        <InputOTP
          maxLength={otpLen}
          value={value}
          onChange={onChange}
          pattern={REGEXP_ONLY_DIGITS}
        >
          {groups.map((slots, gi) => (
            <span key={gi} className="contents">
              {gi > 0 && <InputOTPSeparator />}
              <InputOTPGroup>
                {slots.map(i => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </span>
          ))}
        </InputOTP>
        <RandomButton schema={schema} onChange={onChange} />
        {isNullable && value && <NullButton onChange={onChange} />}
      </div>
    )
  }

  // All other string types + random
  const inputType = ps.format === "email" ? "email"
    : (ps.format === "uri" || ps.format === "url") ? "url"
      : ps.format === "password" ? "password"
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
