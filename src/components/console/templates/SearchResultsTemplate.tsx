import { useState, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { pickSearchFields } from "@/lib/console/apply-layout"
import type { SearchConfig } from "@/lib/console/types"
import type { TemplateProps } from "./index"

export function SearchResultsTemplate({ resource, layoutOverride }: TemplateProps) {
  const { t } = useTranslation()
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  const { fetchJson, loading } = useConsoleFetch()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<unknown[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Tracks the query the latest search was fired with, so the debounce effect
  // doesn't re-fire after a manual Enter/button search of the same query.
  const lastSearchedRef = useRef<string | null>(null)

  const listOp = resource.operations.list
  const action = !listOp ? resource.actions[0] : null
  const route = listOp?.route ?? action?.route

  const queryParam = route?.parameters.find(p =>
    p.in === "query" && ["q", "query", "search", "keyword", "keywords", "term"].includes(p.name.toLowerCase())
  )

  const handleSearch = useCallback(async () => {
    if (!route) return
    lastSearchedRef.current = query
    setError(null)
    const params: Record<string, string> = {}
    if (queryParam && query) params[queryParam.name] = query
    const { data: parsed, error: err } = await fetchJson(route, params)
    if (parsed) {
      const items = Array.isArray(parsed) ? parsed : extractArray(parsed)
      setResults(items)
    } else {
      setResults([])
    }
    setError(err)
  }, [route, queryParam, query, fetchJson])

  // Debounced auto-search while typing (only when the route has a query param)
  const debouncedQuery = useDebouncedValue(query, 400)
  useEffect(() => {
    if (!queryParam) return
    if (debouncedQuery === lastSearchedRef.current) return
    if (debouncedQuery.trim() === "") {
      lastSearchedRef.current = debouncedQuery
      setResults(null)
      return
    }
    handleSearch()
  }, [debouncedQuery, queryParam, handleSearch])

  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div>
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
      </div>

      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={queryParam ? t("console.searchByPlaceholder", { field: queryParam.name }) : t("response.quickFilter")}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="size-4 mr-1.5" />
          {t("console.search")}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )}

      {results !== null && results.length === 0 && !loading && (
        <div className="text-center py-12 text-sm text-muted-foreground">{t("console.noResults")}</div>
      )}

      {results !== null && results.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item, i) => (
            <ResultCard key={i} data={item} config={layout?.searchConfig} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultCard({ data, config }: { data: unknown; config?: SearchConfig | undefined }) {
  if (!data || typeof data !== "object") {
    return <Card><CardContent className="pt-4 text-sm">{String(data)}</CardContent></Card>
  }
  const obj = data as Record<string, unknown>
  const { title, desc, badges } = pickSearchFields(obj, config)

  return (
    <Card>
      <CardHeader className="pb-2">
        {title && <CardTitle className="text-sm truncate">{title}</CardTitle>}
      </CardHeader>
      <CardContent>
        {desc && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{desc}</p>}
        <div className="flex flex-wrap gap-1">
          {badges.map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-[10px] font-normal">
              {key}: {String(value).slice(0, 30)}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    for (const key of ["items", "data", "results", "records", "rows", "hits", "matches"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}
