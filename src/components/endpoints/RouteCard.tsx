import { useState, useCallback, memo } from "react"
import { useTranslation } from "react-i18next"
import { Copy, ChevronDown, Lock } from "lucide-react"
import type { ParsedRoute } from "@/lib/openapi/types"
import { cn } from "@/lib/utils"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { formatMarkdown } from "@/lib/format-route"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleTrigger,
  AnimatedCollapsibleContent,
} from "@/components/ui/collapsible"
import { RouteDetail } from "./RouteDetail"
import { toast } from "sonner"

interface RouteCardProps {
  route: ParsedRoute
  index: number
}

const METHOD_COLORS: Record<string, string> = {
  get: "bg-method-get/15 text-method-get border-method-get/30",
  post: "bg-method-post/15 text-method-post border-method-post/30",
  put: "bg-method-put/15 text-method-put border-method-put/30",
  patch: "bg-method-patch/15 text-method-patch border-method-patch/30",
  delete: "bg-method-delete/15 text-method-delete border-method-delete/30",
  head: "bg-method-head/15 text-method-head border-method-head/30",
  options: "bg-method-options/15 text-method-options border-method-options/30",
}

export const RouteCard = memo(function RouteCard({ route, index }: RouteCardProps) {
  const { t } = useTranslation()
  const { state, toggleRoute } = useOpenAPIContext()
  const isSelected = state.selectedRoutes.has(index)

  const [isOpen, setIsOpen] = useState(false)
  const [detailLoaded, setDetailLoaded] = useState(false)

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (open) setDetailLoaded(true)
  }, [])

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const text = formatMarkdown(route)
    navigator.clipboard.writeText(text).then(() => toast.success(t("toast.copied")))
  }, [route, t])

  const handleCheckChange = useCallback((checked: boolean | "indeterminate") => {
    if (checked === "indeterminate") return
    // Only toggle if the state actually differs
    if (checked !== isSelected) {
      toggleRoute(index)
    }
  }, [index, isSelected, toggleRoute])

  const summary = (route.summary || route.description || "").substring(0, 80)

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(
        "rounded-lg border transition-colors",
        isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      )}
    >
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg">
          <div onClick={e => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckChange}
            />
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0 min-w-[52px] justify-center",
              METHOD_COLORS[route.method] || "bg-muted text-muted-foreground"
            )}
          >
            {route.method}
          </Badge>

          <span className="font-mono text-sm font-medium truncate">
            {route.path}
          </span>

          {route.security?.length > 0 && route.security.some(s => Object.keys(s).length > 0) && (
            <span title={t("endpoints.authRequired")}><Lock className="size-3 text-muted-foreground shrink-0" /></span>
          )}

          {summary && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {summary}
            </span>
          )}

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className="shrink-0"
          >
            <Copy className="size-3" />
            {t("endpoints.copy")}
          </Button>

          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>

      <AnimatedCollapsibleContent>
        <div className="px-3 pb-3 border-t">
          {detailLoaded && <RouteDetail route={route} index={index} />}
        </div>
      </AnimatedCollapsibleContent>
    </Collapsible>
  )
})
