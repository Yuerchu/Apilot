import { useMemo, useState, useCallback } from "react"
import { Search, Copy } from "lucide-react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { formatMarkdown, formatYaml } from "@/lib/format-route"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagFilter } from "./TagFilter"
import { RouteCard } from "./RouteCard"
import { toast } from "sonner"

type FormatType = "markdown" | "yaml"

export function EndpointsView() {
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

  // Group by first tag
  const groupedRoutes = useMemo(() => {
    const grouped: Record<string, Array<{ route: typeof routes[number]; index: number }>> = {}
    for (const item of filteredRoutes) {
      const tag = item.route.tags[0] || "未分组"
      if (!grouped[tag]) grouped[tag] = []
      grouped[tag].push(item)
    }
    return grouped
  }, [filteredRoutes])

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
      toast.error("请先选择路由")
      return
    }
    const formatter = format === "markdown" ? formatMarkdown : formatYaml
    const text = selected.map(r => formatter(r, includeExamples)).join("\n---\n\n")
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`已复制 ${selected.length} 个路由到剪贴板`)
    })
  }, [routes, selectedRoutes, format, includeExamples])

  const handleGroupCheck = useCallback((indices: number[], checked: boolean) => {
    if (checked) {
      selectRoutes(indices)
    } else {
      deselectRoutes(indices)
    }
  }, [selectRoutes, deselectRoutes])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-xs text-muted-foreground">全选</span>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索路由..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

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
            <SelectItem value="markdown">Markdown</SelectItem>
            <SelectItem value="markdown-ex">Markdown + 示例</SelectItem>
            <SelectItem value="yaml">YAML</SelectItem>
            <SelectItem value="yaml-ex">YAML + 示例</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground tabular-nums">
          已选 {selectedCount} 个
        </span>

        <Button size="sm" onClick={handleCopySelected}>
          <Copy className="size-3.5" />
          复制选中
        </Button>
      </div>

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

      {filteredRoutes.length === 0 && routes.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">没有匹配的路由</p>
        </div>
      )}
    </div>
  )
}
