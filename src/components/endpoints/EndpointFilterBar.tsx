import { useState, useMemo, memo } from "react"
import { useTranslation } from "react-i18next"
import { Check, Tag, Activity, X, ArrowLeftRight } from "lucide-react"
import { RefreshCw } from "@/components/animate-ui/icons/refresh-cw"
import { cn } from "@/lib/utils"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useMultiEnvStatus, type InferredStatus } from "@/hooks/use-multi-env-status"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const

const METHOD_COLORS: Record<string, string> = {
  get: "text-method-get",
  post: "text-method-post",
  put: "text-method-put",
  patch: "text-method-patch",
  delete: "text-method-delete",
  head: "text-method-head",
  options: "text-method-options",
}

interface EndpointFilterBarProps {
  activeMethods: Set<string>
  onToggleMethod: (method: string) => void
  onClearMethods: () => void
  statusFilter: InferredStatus | "all"
  onStatusFilterChange: (status: InferredStatus | "all") => void
}

export const EndpointFilterBar = memo(function EndpointFilterBar({
  activeMethods,
  onToggleMethod,
  onClearMethods,
  statusFilter,
  onStatusFilterChange,
}: EndpointFilterBarProps) {
  const { t } = useTranslation()
  const { state, toggleTag, clearTags, invertTags } = useOpenAPIContext()
  const { allTags, activeTags } = state
  const multiEnv = useMultiEnvStatus()

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Tag filter */}
      {allTags.length > 0 && (
        <TagFilterPopover
          allTags={allTags}
          activeTags={activeTags}
          onToggle={toggleTag}
          onClear={clearTags}
          onInvert={invertTags}
        />
      )}

      {/* Method filter */}
      <MethodFilterPopover
        activeMethods={activeMethods}
        onToggle={onToggleMethod}
        onClear={onClearMethods}
      />

      {/* Status filter */}
      {multiEnv.enabled && (
        <>
          <StatusFilterPopover
            value={statusFilter}
            onChange={onStatusFilterChange}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={multiEnv.refresh}
            disabled={multiEnv.loading}
            title={t("envStatus.refresh")}
          >
            <RefreshCw size={14} animate={multiEnv.loading} animateOnHover />
          </Button>
        </>
      )}

      {/* Active filter badges */}
      {(activeTags.size > 0 || activeMethods.size > 0 || statusFilter !== "all") && (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => {
            clearTags()
            onClearMethods()
            onStatusFilterChange("all")
          }}
        >
          <X className="size-3" />
          {t("filter.clearAll")}
        </Button>
      )}
    </div>
  )
})

// ── Tag Filter Popover ──

function TagFilterPopover({
  allTags,
  activeTags,
  onToggle,
  onClear,
  onInvert,
}: {
  allTags: Array<{ name: string; count: number }>
  activeTags: Set<string>
  onToggle: (name: string) => void
  onClear: () => void
  onInvert: (names: string[]) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search) return allTags
    const q = search.toLowerCase()
    return allTags.filter(t => t.name.toLowerCase().includes(q))
  }, [allTags, search])

  const visibleNames = filtered.map(t => t.name)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <Tag className="size-3" />
          {t("tags.filter")}
          {activeTags.size > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-0">
              {activeTags.size}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder={t("tags.search")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 p-2 border-b">
          <Button variant="ghost" size="xs" onClick={onClear} disabled={activeTags.size === 0}>
            <X className="size-3" />
            {t("tags.clear")}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onInvert(visibleNames)}>
            <ArrowLeftRight className="size-3" />
            {t("tags.invert")}
          </Button>
        </div>
        <div className="max-h-64 overflow-auto p-1">
          {filtered.map(tag => (
            <button
              key={tag.name}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent transition-colors"
              onClick={() => onToggle(tag.name)}
            >
              <div className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                activeTags.has(tag.name)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input"
              )}>
                {activeTags.has(tag.name) && <Check className="size-3" />}
              </div>
              <span className="truncate flex-1 text-left">{tag.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{tag.count}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              {t("endpoints.noMatch")}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Method Filter Popover ──

function MethodFilterPopover({
  activeMethods,
  onToggle,
  onClear,
}: {
  activeMethods: Set<string>
  onToggle: (method: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          {t("filter.method")}
          {activeMethods.size > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-0">
              {activeMethods.size}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {METHODS.map(method => (
          <button
            key={method}
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent transition-colors"
            onClick={() => onToggle(method)}
          >
            <div className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-sm border",
              activeMethods.has(method)
                ? "bg-primary border-primary text-primary-foreground"
                : "border-input"
            )}>
              {activeMethods.has(method) && <Check className="size-3" />}
            </div>
            <span className={cn("font-mono font-semibold uppercase", METHOD_COLORS[method])}>
              {method}
            </span>
          </button>
        ))}
        {activeMethods.size > 0 && (
          <div className="border-t mt-1 pt-1">
            <Button variant="ghost" size="xs" className="w-full justify-start" onClick={onClear}>
              <X className="size-3" />
              {t("tags.clear")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Status Filter Popover ──

const STATUS_OPTIONS: Array<{ value: InferredStatus | "all"; key: string }> = [
  { value: "all", key: "envStatus.allStatuses" },
  { value: "online", key: "envStatus.online" },
  { value: "testing", key: "envStatus.testing" },
  { value: "inDev", key: "envStatus.inDev" },
  { value: "localOnly", key: "envStatus.localOnly" },
  { value: "teammate", key: "envStatus.teammate" },
]

function StatusFilterPopover({
  value,
  onChange,
}: {
  value: InferredStatus | "all"
  onChange: (v: InferredStatus | "all") => void
}) {
  const { t } = useTranslation()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <Activity className="size-3" />
          {value === "all" ? t("envStatus.filterByStatus") : t(`envStatus.${value}`)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value ?? "null"}
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent transition-colors"
            onClick={() => onChange(opt.value)}
          >
            <div className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border",
              value === opt.value
                ? "bg-primary border-primary text-primary-foreground"
                : "border-input"
            )}>
              {value === opt.value && <Check className="size-3" />}
            </div>
            <span>{t(opt.key)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
