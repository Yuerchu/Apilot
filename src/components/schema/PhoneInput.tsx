import { useState, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  getCountries,
  getCountryCallingCode,
  AsYouType,
  getExampleNumber,
  type CountryCode,
} from "libphonenumber-js"
import examples from "libphonenumber-js/mobile/examples"
import { Dices, X, ChevronDown, ChevronsUpDown, Check, Globe } from "lucide-react"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, generateExample } from "@/lib/openapi"
import { getRandomVariants, generateWithVariant } from "@/lib/openapi/generate-example"
import { cn } from "@/lib/utils"
import { InputGroupButton } from "@/components/ui/input-group"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CountryEntry {
  code: CountryCode
  name: string
  callingCode: string
  flag: string
}

function countryFlag(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(c => c.codePointAt(0)! - 65 + 0x1F1E6),
  )
}

function buildCountryList(locale: string): CountryEntry[] {
  const bcp47 = locale.replace(/_/g, "-")
  const displayNames = new Intl.DisplayNames([bcp47, "en"], { type: "region" })
  return getCountries()
    .map(code => ({
      code,
      name: displayNames.of(code) ?? code,
      callingCode: getCountryCallingCode(code),
      flag: countryFlag(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function detectCountry(value: string): CountryCode | null {
  if (!value || !value.startsWith("+")) return null
  // AsYouType resolves the country from a partial number (e.g. "+86" → CN)
  const ayt = new AsYouType()
  ayt.input(value)
  return ayt.getCountry() ?? null
}

function getNationalLength(country: CountryCode): number {
  const example = getExampleNumber(country, examples)
  return example ? example.nationalNumber.length : 10
}

function generateNational(country: CountryCode): string {
  const len = getNationalLength(country)
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("")
}

export interface PhoneInputProps {
  schema: SchemaObject
  value: string
  onChange: (value: string) => void
  onBlur?: (() => void) | undefined
  nullable?: boolean | undefined
  errorClass?: string | undefined
}

export function PhoneInput({ schema, value, onChange, onBlur, nullable, errorClass }: PhoneInputProps) {
  const { t, i18n } = useTranslation()
  const countries = useMemo(() => buildCountryList(i18n.language), [i18n.language])
  const [open, setOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(() => detectCountry(value))

  const ps = resolveEffectiveSchema(schema)
  const defaultPrefix = ps.format === "e164" || ps.format === "e.164"
  const [prefixOn, setPrefixOn] = useState(defaultPrefix)

  useEffect(() => {
    const detected = detectCountry(value)
    if (!detected) return
    // Compare by calling code so a manual pick among shared codes (+1 US/CA) isn't overridden
    if (selectedCountry && getCountryCallingCode(detected) === getCountryCallingCode(selectedCountry)) return
    setSelectedCountry(detected)
    if (!prefixOn) setPrefixOn(true)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(
    () => countries.find(c => c.code === selectedCountry),
    [countries, selectedCountry],
  )

  // The input box shows only the national part; the calling code lives in the prefix button
  const prefix = selected ? `+${selected.callingCode}` : null
  const displayValue = prefix && value.startsWith(prefix) ? value.slice(prefix.length) : value

  const handleInput = (text: string) => {
    if (prefix && prefixOn && text && !text.startsWith("+")) {
      onChange(`${prefix}${text}`)
    } else {
      onChange(text)
    }
  }

  const togglePrefix = () => {
    if (!prefix) return
    if (prefixOn) {
      if (value.startsWith(prefix)) onChange(value.slice(prefix.length))
    } else if (value && !value.startsWith("+")) {
      onChange(`${prefix}${value}`)
    }
    setPrefixOn(prev => !prev)
  }

  const variants = getRandomVariants(schema)

  const handleRandom = () => {
    if (selectedCountry) {
      const national = generateNational(selectedCountry)
      if (prefixOn) {
        onChange(`+${getCountryCallingCode(selectedCountry)}${national}`)
      } else {
        onChange(national)
      }
    } else {
      const val = generateExample(schema)
      if (val !== null && val !== undefined) onChange(String(val))
    }
  }

  const handleVariant = (variantId: string) => {
    const val = generateWithVariant(schema, variantId)
    if (val !== null && val !== undefined) onChange(String(val))
  }

  const handleCountrySelect = (country: CountryEntry) => {
    if (prefixOn) {
      const newPrefix = `+${country.callingCode}`
      if (prefix && value.startsWith(prefix)) {
        onChange(newPrefix + value.slice(prefix.length))
      } else if (value && !value.startsWith("+")) {
        onChange(newPrefix + value)
      }
    }
    setSelectedCountry(country.code)
    setOpen(false)
  }

  const placeholder = selected
    ? `${getNationalLength(selected.code)} digits`
    : (prefixOn ? "+1234567890" : "1234567890")

  return (
    <div className="flex items-center gap-1">
      <div
        className={cn(
          "flex h-8 flex-1 min-w-0 items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          errorClass,
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-full shrink-0 items-center gap-1 rounded-l-md border-r border-input px-2 text-xs hover:bg-accent hover:text-accent-foreground"
            >
              {selected ? <span>{selected.flag}</span> : <Globe className="size-3.5 text-muted-foreground" />}
              <ChevronsUpDown className="size-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={t("tryIt.searchCountry", "Search country...")}
                className="h-8 text-xs"
              />
              <CommandList className="max-h-[240px]">
                <CommandEmpty>{t("tryIt.noCountryFound", "No country found")}</CommandEmpty>
                <CommandGroup>
                  {countries.map(c => (
                    <CommandItem
                      key={c.code}
                      value={`${c.flag} ${c.name} ${c.code} +${c.callingCode}`}
                      onSelect={() => handleCountrySelect(c)}
                      className="text-xs gap-2"
                    >
                      <Check className={cn("size-3", selectedCountry === c.code ? "opacity-100" : "opacity-0")} />
                      <span>{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-muted-foreground font-mono">+{c.callingCode}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected && (
          <button
            type="button"
            className={cn(
              "h-full shrink-0 border-r border-input px-1.5 font-mono text-xs hover:bg-accent hover:text-accent-foreground",
              !prefixOn && "text-muted-foreground line-through opacity-50",
            )}
            onClick={togglePrefix}
            title={prefixOn ? t("tryIt.prefixOn", "Click to exclude calling code") : t("tryIt.prefixOff", "Click to include calling code")}
          >
            +{selected.callingCode}
          </button>
        )}

        <input
          type="tel"
          className="h-full w-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          value={displayValue}
          onChange={e => handleInput(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
        />

        <div className="flex shrink-0 items-center pr-1.5">
          <InputGroupButton size="icon-xs" title={t("tryIt.random")} onClick={handleRandom}>
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
          {nullable && value && (
            <InputGroupButton size="icon-xs" onClick={() => onChange("")}>
              <X />
            </InputGroupButton>
          )}
        </div>
      </div>
    </div>
  )
}
