import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Search, Copy } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ViewToolbarProps {
  // Select all
  selectAllChecked: boolean | "indeterminate"
  onSelectAllChange: (checked: boolean | "indeterminate") => void
  // Search
  searchPlaceholder?: string
  filter: string
  onFilterChange: (value: string) => void
  // Counts
  totalCount?: number
  totalLabel?: string
  selectedCount: number
  selectedLabel?: string
  // Copy
  onCopy: () => void
  // Extra controls (e.g. format selector, tag filter)
  children?: ReactNode
}

export function ViewToolbar({
  selectAllChecked,
  onSelectAllChange,
  searchPlaceholder = "搜索...",
  filter,
  onFilterChange,
  totalCount,
  totalLabel = "项",
  selectedCount,
  selectedLabel = "个",
  onCopy,
  children,
}: ViewToolbarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={selectAllChecked}
          onCheckedChange={onSelectAllChange}
        />
        <span className="text-xs text-muted-foreground">{t("toolbar.selectAll")}</span>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {children}

      {totalCount !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalCount} {totalLabel}
        </span>
      )}

      {selectedCount > 0 && (
        <span className="text-xs text-primary font-medium tabular-nums">
          {t("toolbar.selected", { count: selectedCount })} {selectedLabel}
        </span>
      )}

      <Button size="sm" onClick={onCopy} disabled={selectedCount === 0}>
        <Copy className="size-3.5" />
        {t("toolbar.copySelected")}
      </Button>
    </div>
  )
}
