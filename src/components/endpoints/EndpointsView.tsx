import { useMemo, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { formatMarkdown, formatYaml } from "@/lib/format-route"
import { useProgressiveRender } from "@/hooks/use-progressive-render"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ViewToolbar } from "@/components/layout/ViewToolbar"
import { TagFilter } from "./TagFilter"
import { RouteCard } from "./RouteCard"
import { toast } from "sonner"

type FormatType = "markdown" | "yaml"

export function EndpointsView() {
  const { t } = useTranslation()
  const {
    state,
    selectRoutes,
    deselectRoutes,
    setFilter,
  } = useOpenAPIContext()
  const { routes, selectedRoutes, activeTags, filter } = state

  const [format, setFormat] = useState<FormatType>("markdown")
  const [includeExamples, setIncludeExamples] = useState(false)

  // Filter routes by search + tags
  const filteredRoutes = useMemo(() => {
    return routes
      .map((r, i) => ({ route: r, index: i }))
      .filter(({ route }) => {
        if (activeTags.size > 0 && !route.tags.some(t => activeTags.has(t))) return false
        if (filter) {
          const haystack = `${route.method} ${route.path} ${route.summary} ${route.description} ${route.tags.join(" ")} ${route.operationId}`.toLowerCase()
          if (!haystack.includes(filter.toLowerCase())) return false
        }
        return true
      })
  }, [routes, activeTags, filter])

  // Progressive rendering — show first batch immediately, then add more
  const { visible: visibleRoutes, isComplete } = useProgressiveRender(filteredRoutes, 30, 40)

  // Group by first tag (only visible items)
  const groupedRoutes = useMemo(() => {
    const grouped: Record<string, Array<{ route: typeof routes[number]; index: number }>> = {}
    for (const item of visibleRoutes) {
      const tag = item.route.tags[0] || t("endpoints.ungrouped")
      if (!grouped[tag]) grouped[tag] = []
      grouped[tag].push(item)
    }
    return grouped
  }, [visibleRoutes])

  const selectedCount = selectedRoutes.size
  const allFilteredIndices = filteredRoutes.map(r => r.index)
  const allFilteredSelected = allFilteredIndices.length > 0 && allFilteredIndices.every(i => selectedRoutes.has(i))
  const someFilteredSelected = allFilteredIndices.some(i => selectedRoutes.has(i))

  const handleSelectAll = useCallback((checked: boolean | "indeterminate") => {
    if (checked === true) {
      selectRoutes(allFilteredIndices)
    } else {
      deselectRoutes(allFilteredIndices)
    }
  }, [allFilteredIndices, selectRoutes, deselectRoutes])

  const handleCopySelected = useCallback(() => {
    const selected = routes.filter((_, i) => selectedRoutes.has(i))
    if (!selected.length) {
      toast.error(t("toast.selectRoutes"))
      return
    }
    const formatter = format === "markdown" ? formatMarkdown : formatYaml
    const text = selected.map(r => formatter(r, includeExamples)).join("\n---\n\n")
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t("toast.copiedRoutes", { count: selected.length }))
    })
  }, [routes, selectedRoutes, format, includeExamples, t])

  const handleGroupCheck = useCallback((indices: number[], checked: boolean) => {
    if (checked) {
      selectRoutes(indices)
    } else {
      deselectRoutes(indices)
    }
  }, [selectRoutes, deselectRoutes])

  return (
    <div className="space-y-3">
      <ViewToolbar
        selectAllChecked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
        onSelectAllChange={handleSelectAll}
        searchPlaceholder={t("endpoints.search")}
        filter={filter}
        onFilterChange={setFilter}
        selectedCount={selectedCount}
        onCopy={handleCopySelected}
      >
        <Select value={`${format}${includeExamples ? "-ex" : ""}`} onValueChange={v => {
          const hasEx = v.endsWith("-ex")
          const fmt = v.replace("-ex", "") as "markdown" | "yaml"
          setFormat(fmt)
          setIncludeExamples(hasEx)
        }}>
          <SelectTrigger className="w-auto h-8 text-xs gap-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="markdown">{t("endpoints.markdown")}</SelectItem>
            <SelectItem value="markdown-ex">{t("endpoints.markdownExample")}</SelectItem>
            <SelectItem value="yaml">{t("endpoints.yaml")}</SelectItem>
            <SelectItem value="yaml-ex">{t("endpoints.yamlExample")}</SelectItem>
          </SelectContent>
        </Select>
      </ViewToolbar>

      {/* Tag filter */}
      <TagFilter />

      {/* Route groups */}
      {Object.entries(groupedRoutes).map(([tag, items]) => {
        const indices = items.map(it => it.index)
        const allSelected = indices.every(i => selectedRoutes.has(i))
        const someSelected = indices.some(i => selectedRoutes.has(i))

        return (
          <div key={tag} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={checked => {
                    handleGroupCheck(indices, checked === true)
                  }}
                />
              </div>
              <h2 className="text-sm font-semibold text-foreground">{tag}</h2>
            </div>

            <div className="space-y-2">
              {items.map(({ route, index }) => (
                <RouteCard key={`${route.method}-${route.path}-${index}`} route={route} index={index} />
              ))}
            </div>
          </div>
        )
      })}

      {!isComplete && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      )}

      {filteredRoutes.length === 0 && routes.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{t("endpoints.noMatch")}</p>
        </div>
      )}
    </div>
  )
}
