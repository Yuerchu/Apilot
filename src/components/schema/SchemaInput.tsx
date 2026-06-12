import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dices, X, ChevronDown, ChevronsUpDown, Check } from "lucide-react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, getTypeStr, generateExample } from "@/lib/openapi"
import { getRandomVariants, generateWithVariant } from "@/lib/openapi/generate-example"
import { resolveWidget, getExplicitWidget, detectOtpLength, IMPLEMENTED_WIDGETS } from "@/lib/resolve-widget"
import { cn } from "@/lib/utils"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { PhoneInput } from "@/components/schema/PhoneInput"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

/**
 * Compact icon actions shared by every widget row: random (dice), variant picker, clear.
 * Rendered inside an InputGroupAddon or as a standalone trailing group — same visual either way.
 */
function InlineActions({
  schema,
  onChange,
  isNullable,
  value,
}: {
  schema: SchemaObject
  onChange: (v: string) => void
  isNullable: boolean
  value: string
}) {
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

  return (
    <>
      <InputGroupButton size="icon-xs" title={t("tryIt.random")} onClick={handleDefault}>
        <Dices />
      </InputGroupButton>
      {variants.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <InputGroupButton size="icon-xs" className="-ml-1 w-4">
              <ChevronDown className="size-3" />
            </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            {variants.map(v => (
              <DropdownMenuItem key={v.id} onClick={() => handleVariant(v.id)} className="text-xs">
                {v.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {isNullable && value && (
        <InputGroupButton size="icon-xs" onClick={() => onChange("")}>
          <X />
        </InputGroupButton>
      )}
    </>
  )
}

/** Segmented single-choice control: muted track, raised active item, deselect to clear */
function SegmentedInput({
  options,
  value,
  onChange,
  errorClass,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  errorClass?: string
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={value}
      onValueChange={v => onChange(v ?? "")}
      className={cn("w-full flex-wrap justify-start rounded-lg border border-transparent bg-muted p-1", errorClass)}
    >
      {options.map(opt => (
        <ToggleGroupItem
          key={opt}
          value={opt}
          className="h-6 grow rounded-md px-2.5 text-xs font-normal text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {opt}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Searchable single-select for large enums (Command + Popover, same pattern as PhoneInput's country picker) */
function EnumCombobox({
  options,
  value,
  onChange,
  errorClass,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  errorClass?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between text-xs font-normal", !value && "text-muted-foreground", errorClass)}
        >
          <span className="truncate font-mono">{value || t("tryIt.selectValue", "Select...")}</span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("tryIt.searchEnum", "Search...")} className="h-8 text-xs" />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>{t("search.noResults")}</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt === value ? "" : opt)
                    setOpen(false)
                  }}
                  className="text-xs font-mono gap-2"
                >
                  <Check className={cn("size-3", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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

  const explicit = getExplicitWidget(ps)
  const widget = explicit && IMPLEMENTED_WIDGETS.has(explicit) ? explicit : resolveWidget(ps)

  // Options for choice widgets; booleans get a synthetic true/false pair
  const enumOptions = ps.enum ? ps.enum.map(String) : ps.type === "boolean" ? ["true", "false"] : null

  switch (widget) {
    case "radio":
    case "switch":
      if (enumOptions) {
        return (
          <SegmentedInput
            options={enumOptions}
            value={value}
            onChange={onChange}
            errorClass={errorClass}
          />
        )
      }
      break

    case "combobox":
      if (enumOptions) {
        return (
          <EnumCombobox
            options={enumOptions}
            value={value}
            onChange={onChange}
            errorClass={errorClass}
          />
        )
      }
      break

    // Native dropdown — reachable only via explicit x-widget: "select"
    case "select":
      if (enumOptions) {
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("h-8 w-full text-xs", errorClass)}>
              <SelectValue placeholder={isNullable ? "null" : t("tryIt.empty")} />
            </SelectTrigger>
            <SelectContent>
              {isNullable && <SelectItem value="__null__">null</SelectItem>}
              {!required && !isNullable && <SelectItem value="__empty__">{t("tryIt.empty")}</SelectItem>}
              {enumOptions.map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      break

    case "slider": {
      const min = ps.minimum ?? 0
      const max = ps.maximum ?? 100
      const isInt = ps.type === "integer"
      const step = ps.multipleOf ?? (isInt ? 1 : (max - min) / 100)
      const num = Number(value)
      // Empty value parks the thumb at min visually but never emits until the user interacts
      const sliderVal = value !== "" && Number.isFinite(num) ? num : min
      return (
        <div className="flex items-center gap-2">
          <Slider
            className="min-w-[60px] flex-1"
            min={min}
            max={max}
            step={step}
            value={[sliderVal]}
            onValueChange={([n]) => onChange(String(n))}
          />
          <InputGroup className={cn("h-8 w-fit shrink-0", errorClass)}>
            <InputGroupInput
              type="number"
              className="h-full w-16 text-sm"
              step={isInt ? "1" : "any"}
              min={min}
              max={max}
              value={value}
              onChange={e => onChange(e.target.value)}
              onBlur={onBlur}
            />
            <InputGroupAddon align="inline-end">
              <InlineActions schema={schema} onChange={onChange} isNullable={isNullable} value={value} />
            </InputGroupAddon>
          </InputGroup>
        </div>
      )
    }

    case "number":
      return (
        <InputGroup className={cn("h-8", errorClass)}>
          <InputGroupInput
            type="number"
            className="h-full text-sm"
            step={ps.type === "integer" ? "1" : "any"}
            min={ps.minimum}
            max={ps.maximum}
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={ph}
          />
          <InputGroupAddon align="inline-end">
            <InlineActions schema={schema} onChange={onChange} isNullable={isNullable} value={value} />
          </InputGroupAddon>
        </InputGroup>
      )

    case "datetime":
    case "date":
      return (
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <DateTimePicker value={value} onChange={onChange} mode={widget === "date" ? "date" : "datetime"} />
          </div>
          <div className="flex shrink-0 items-center">
            <InlineActions schema={schema} onChange={onChange} isNullable={false} value={value} />
          </div>
        </div>
      )

    case "phone":
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

    case "otp": {
      const otpLen = detectOtpLength(ps) ?? 6
      const groups: number[][] = []
      if (otpLen <= 4) {
        groups.push(Array.from({ length: otpLen }, (_, i) => i))
      } else {
        const half = Math.ceil(otpLen / 2)
        groups.push(Array.from({ length: half }, (_, i) => i))
        groups.push(Array.from({ length: otpLen - half }, (_, i) => i + half))
      }
      return (
        <div className="flex items-center justify-between gap-1">
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
          <div className="flex shrink-0 items-center">
            <InlineActions schema={schema} onChange={onChange} isNullable={isNullable} value={value} />
          </div>
        </div>
      )
    }

    case "textarea":
      return (
        <InputGroup className={cn(errorClass)}>
          <InputGroupTextarea
            className="min-h-[72px] text-sm"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={ph}
            minLength={ps.minLength}
            maxLength={ps.maxLength}
          />
          <InputGroupAddon align="block-end" className="justify-end gap-1 py-1.5">
            <InlineActions schema={schema} onChange={onChange} isNullable={isNullable} value={value} />
          </InputGroupAddon>
        </InputGroup>
      )
  }

  // Text-like fallback (input / password / email / url, or a choice widget without options)
  const inputType = widget === "email" ? "email"
    : widget === "url" ? "url"
      : widget === "password" ? "password"
        : "text"
  const placeholder = ps.format === "uuid" ? "UUID"
    : ps.format === "email" ? "user@example.com"
      : (ps.format === "uri" || ps.format === "url") ? "https://example.com"
        : ph

  return (
    <InputGroup className={cn("h-8", errorClass)}>
      <InputGroupInput
        type={inputType}
        className="h-full text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        minLength={ps.minLength}
        maxLength={ps.maxLength}
        pattern={ps.pattern}
      />
      <InputGroupAddon align="inline-end">
        <InlineActions schema={schema} onChange={onChange} isNullable={isNullable} value={value} />
      </InputGroupAddon>
    </InputGroup>
  )
}
