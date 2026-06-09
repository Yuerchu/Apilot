import { useState, useCallback } from "react"
import { Search, RotateCcw, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Parameter } from "@/lib/openapi/types"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"

const AUTH_PARAMS = new Set(["token", "authorization", "access_token", "api_key", "apikey", "auth", "bearer"])
const EMPTY_SENTINEL = "__empty__"

interface ConsoleFilterBarProps {
  params: Parameter[]
  excludeParams: Set<string>
  onSearch: (filters: Record<string, string>) => void
}

export function ConsoleFilterBar({ params, excludeParams, onSearch }: ConsoleFilterBarProps) {
  const filterParams = params.filter(p => {
    if (p.in !== "query") return false
    if (excludeParams.has(p.name)) return false
    if (AUTH_PARAMS.has(p.name.toLowerCase())) return false
    return true
  })

  const [values, setValues] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(false)

  const setValue = useCallback((name: string, value: string) => {
    setValues(prev => {
      if (!value) {
        const next = { ...prev }
        delete next[name]
        return next
      }
      return { ...prev, [name]: value }
    })
  }, [])

  const handleSearch = useCallback(() => {
    onSearch(values)
  }, [onSearch, values])

  const handleReset = useCallback(() => {
    setValues({})
    onSearch({})
  }, [onSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }, [handleSearch])

  if (filterParams.length === 0) return null

  const visibleCount = 4
  const visibleParams = filterParams.slice(0, visibleCount)
  const collapsedParams = filterParams.slice(visibleCount)
  const hasMore = collapsedParams.length > 0
  const activeCount = Object.keys(values).length

  return (
    <div className="rounded-md border bg-card p-3 space-y-2.5">
      <div className="flex items-end gap-2 flex-wrap" onKeyDown={handleKeyDown}>
        {visibleParams.map(p => (
          <FilterField key={p.name} param={p} value={values[p.name] ?? ""} onChange={v => setValue(p.name, v)} />
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <Button size="sm" onClick={handleSearch}>
            <Search className="size-3.5 mr-1" />
            Search
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} disabled={activeCount === 0}>
            <RotateCcw className="size-3.5 mr-1" />
            Reset
          </Button>
          {hasMore && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              <ChevronsUpDown className="size-3.5 mr-1" />
              {expanded ? "Less" : `+${collapsedParams.length}`}
            </Button>
          )}
        </div>
      </div>
      {hasMore && expanded && (
        <div className="flex items-end gap-2 flex-wrap pt-1 border-t" onKeyDown={handleKeyDown}>
          {collapsedParams.map(p => (
            <FilterField key={p.name} param={p} value={values[p.name] ?? ""} onChange={v => setValue(p.name, v)} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterField({ param, value, onChange }: { param: Parameter; value: string; onChange: (v: string) => void }) {
  const schema = param.schema ? resolveEffectiveSchema(param.schema) : null
  const enumValues = param.enum ?? schema?.enum ?? null
  const type = param.type ?? schema?.type ?? "string"
  const format = param.format ?? schema?.format
  const description = param.description ?? schema?.description ?? ""
  const label = description ? (description.length > 30 ? description.slice(0, 30) + "…" : description) : param.name

  if (enumValues && Array.isArray(enumValues)) {
    return (
      <div className="space-y-1 min-w-[140px]">
        <Label className="text-[11px] text-muted-foreground truncate block" title={`${param.name}: ${description}`}>
          {label}
        </Label>
        <Select value={value || EMPTY_SENTINEL} onValueChange={v => onChange(v === EMPTY_SENTINEL ? "" : v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder={param.name} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SENTINEL}>
              <span className="text-muted-foreground">All</span>
            </SelectItem>
            {enumValues.map(v => (
              <SelectItem key={String(v)} value={String(v)}>{String(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (type === "boolean") {
    return (
      <div className="space-y-1 min-w-[100px]">
        <Label className="text-[11px] text-muted-foreground truncate block" title={`${param.name}: ${description}`}>
          {label}
        </Label>
        <Select value={value || EMPTY_SENTINEL} onValueChange={v => onChange(v === EMPTY_SENTINEL ? "" : v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder={param.name} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SENTINEL}><span className="text-muted-foreground">All</span></SelectItem>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  const inputType = type === "integer" || type === "number" ? "number"
    : format === "date-time" ? "datetime-local"
    : format === "date" ? "date"
    : "text"

  return (
    <div className="space-y-1 min-w-[140px] max-w-[220px]">
      <Label className="text-[11px] text-muted-foreground truncate block" title={`${param.name}: ${description}`}>
        {label}
      </Label>
      <Input
        type={inputType}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={param.name}
        className="h-7 text-xs"
      />
    </div>
  )
}
