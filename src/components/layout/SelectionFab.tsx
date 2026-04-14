import { useTranslation } from "react-i18next"
import { Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SelectionFabProps {
  count: number
  label?: string
  onCopy: () => void
  onClear: () => void
}

export function SelectionFab({ count, label = "个", onCopy, onClear }: SelectionFabProps) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-lg transition-all duration-200",
        count > 0
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none"
      )}
    >
      <span className="text-sm">
        {t("toolbar.selected", { count })} {label}
      </span>
      <Button size="sm" onClick={onCopy}>
        <Copy className="size-3" />
        {t("toolbar.copySelected")}
      </Button>
      <Button size="sm" variant="destructive" onClick={onClear}>
        <X className="size-3" />
        {t("tags.clear")}
      </Button>
    </div>
  )
}
