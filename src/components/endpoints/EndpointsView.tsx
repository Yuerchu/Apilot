import { useMemo, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import type { ParsedRoute } from "@/lib/openapi/types"
import { Checkbox } from "@/components/ui/checkbox"
import { ViewToolbar } from "@/components/layout/ViewToolbar"
import { TagFilter } from "./TagFilter"
import { RouteCard } from "./RouteCard"

type VirtualRow =
  | { type: "group"; tag: string; indices: number[] }
  | { type: "route"; route: ParsedRoute; index: number }

export function EndpointsView() {
  const { t } = useTranslation()
  const {
    state,
    selectRoutes,
    deselectRoutes,
    setFilter,
  } = useOpenAPIContext()
  const { routes, selectedRoutes, activeTags, filter } = state

  // Filter routes
  const filteredRoutes = useMemo(() => {
    return routes
      .map((r, i) => ({ route: r, index: i }))
      .filter(({ route }) => {
        if (activeTags.size > 0 && !route.tags.some(tg => activeTags.has(tg))) return false
        if (filter) {
          const haystack = `${route.method} ${route.path} ${route.summary} ${route.description} ${route.tags.join(" ")} ${route.operationId}`.toLowerCase()
          if (!haystack.includes(filter.toLowerCase())) return false
        }
        return true
      })
  }, [routes, activeTags, filter])

  // Flatten grouped routes into virtual rows: [group header, route, route, group header, route, ...]
  const virtualRows = useMemo<VirtualRow[]>(() => {
    const grouped: Record<string, Array<{ route: typeof routes[number]; index: number }>> = {}
    for (const item of filteredRoutes) {
      const tag = item.route.tags[0] || t("endpoints.ungrouped")
      if (!grouped[tag]) grouped[tag] = []
      grouped[tag].push(item)
    }
    const rows: VirtualRow[] = []
    for (const [tag, items] of Object.entries(grouped)) {
      rows.push({ type: "group", tag, indices: items.map(it => it.index) })
      for (const item of items) {
        rows.push({ type: "route", route: item.route, index: item.index })
      }
    }
    return rows
  }, [filteredRoutes, t])

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


  const handleGroupCheck = useCallback((indices: number[], checked: boolean) => {
    if (checked) {
      selectRoutes(indices)
    } else {
      deselectRoutes(indices)
    }
  }, [selectRoutes, deselectRoutes])

  // Virtual list
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => virtualRows[i]?.type === "group" ? 36 : 44,
    overscan: 15,
  })

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <ViewToolbar
        selectAllChecked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
        onSelectAllChange={handleSelectAll}
        searchPlaceholder={t("endpoints.search")}
        filter={filter}
        onFilterChange={setFilter}
        selectedCount={selectedCount}
      />

      {/* Tag filter */}
      <TagFilter />

      {/* Virtualized route list */}
      <div
        ref={parentRef}
        className="overflow-auto flex-1 min-h-0"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = virtualRows[virtualRow.index]
            if (!row) return null
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === "group" ? (
                  <div className="flex items-center gap-2 px-1 pb-1 pt-3">
                    <div onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={
                          row.indices.every(i => selectedRoutes.has(i))
                            ? true
                            : row.indices.some(i => selectedRoutes.has(i))
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={checked => {
                          handleGroupCheck(row.indices, checked === true)
                        }}
                      />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">{row.tag}</h2>
                  </div>
                ) : (
                  <div className="pb-2">
                    <RouteCard route={row.route} index={row.index} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredRoutes.length === 0 && routes.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">{t("endpoints.noMatch")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
