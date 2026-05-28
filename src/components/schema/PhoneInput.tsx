import { useState, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumber,
  getExampleNumber,
  type CountryCode,
} from "libphonenumber-js"
import examples from "libphonenumber-js/mobile/examples"
import { Dices, X, ChevronDown, ChevronsUpDown, Check } from "lucide-react"
import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema, generateExample } from "@/lib/openapi"
import { getRandomVariants, generateWithVariant } from "@/lib/openapi/generate-example"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  try {
    const parsed = parsePhoneNumber(value)
    return parsed?.country ?? null
  } catch {
    return null
  }
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
    if (detected && detected !== selectedCountry) {
      setSelectedCountry(detected)
      if (!prefixOn) setPrefixOn(true)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(
    () => countries.find(c => c.code === selectedCountry),
    [countries, selectedCountry],
  )

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
    setSelectedCountry(country.code)
    setOpen(false)
  }

  const placeholder = selected
    ? (prefixOn ? `+${selected.callingCode}...` : `${getNationalLength(selected.code)} digits`)
    : (prefixOn ? "+1234567890" : "1234567890")

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 shrink-0 gap-1 text-xs"
            type="button"
          >
            {selected ? <span>{selected.flag}</span> : <span className="text-muted-foreground">🌐</span>}
            <ChevronsUpDown className="size-3 opacity-50" />
          </Button>
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
        <Button
          variant={prefixOn ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-8 px-1.5 shrink-0 font-mono text-xs", !prefixOn && "opacity-40")}
          type="button"
          onClick={() => setPrefixOn(prev => !prev)}
          title={prefixOn ? t("tryIt.prefixOn", "Click to exclude calling code") : t("tryIt.prefixOff", "Click to include calling code")}
        >
          +{selected.callingCode}
        </Button>
      )}

      <Input
        type="tel"
        className={cn("h-8 text-sm flex-1", errorClass)}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
      />

      <div className="flex shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-r-none border-r-0"
          type="button"
          onClick={handleRandom}
        >
          <Dices className="size-3.5" />
          {t("tryIt.random")}
        </Button>
        {variants.length > 0 && (
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
        )}
      </div>

      {nullable && value && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0" type="button" onClick={() => onChange("")}>
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
