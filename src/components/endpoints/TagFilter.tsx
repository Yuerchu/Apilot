import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, X, ArrowLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function TagFilter() {
  const { t } = useTranslation()
  const { state, toggleTag, clearTags, invertTags } = useOpenAPIContext()
  const { allTags, activeTags } = state
  const [isOpen, setIsOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState("")

  if (allTags.length === 0) return null

  const filteredTags = tagSearch
    ? allTags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTags

  const visibleTagNames = filteredTags.map(t => t.name)

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronRight
          className={cn(
            "size-4 transition-transform",
            isOpen && "rotate-90"
          )}
        />
        <span className="font-medium">{t("tags.filter")}</span>
        <Badge variant="secondary" className="text-xs">
          {allTags.length}
        </Badge>
        {activeTags.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("tags.selectedCount", { count: activeTags.size })}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="border-t px-4 py-3 space-y-3">
          <Input
            type="text"
            placeholder={t("tags.search")}
            value={tagSearch}
            onChange={e => setTagSearch(e.target.value)}
            className="h-8 text-sm"
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={clearTags}
              disabled={activeTags.size === 0}
            >
              <X className="size-3" />
              {t("tags.clear")}
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => invertTags(visibleTagNames)}
            >
              <ArrowLeftRight className="size-3" />
              {t("tags.invert")}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filteredTags.map(tag => (
              <button
                key={tag.name}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                  activeTags.has(tag.name)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary"
                )}
                onClick={() => toggleTag(tag.name)}
              >
                {tag.name}
                <span className={cn(
                  "text-[10px] tabular-nums",
                  activeTags.has(tag.name)
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}>
                  {tag.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
