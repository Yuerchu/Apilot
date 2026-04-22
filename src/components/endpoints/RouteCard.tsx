import { useCallback, useMemo, memo } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Lock, Share2, Star } from "lucide-react"
import type { ParsedRoute } from "@/lib/openapi/types"
import { getParsedRouteKey } from "@/lib/openapi/route-key"
import { cn } from "@/lib/utils"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { formatMarkdown } from "@/lib/format-route"
import { useMultiEnvStatus, type InferredStatus } from "@/hooks/use-multi-env-status"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "@/components/animate-ui/components/buttons/copy"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleTrigger,
  AnimatedCollapsibleContent,
} from "@/components/ui/collapsible"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { PathTemplate } from "./PathTemplate"
import { RouteDetail } from "./RouteDetail"
import { toast } from "sonner"
import { useShareDialog } from "@/components/share/ShareDialog"

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

export const RouteCard = memo(function RouteCard({ route, index, isFavorite, onToggleFavorite }: RouteCardProps & { isFavorite?: boolean; onToggleFavorite?: (routeKey: string) => void }) {
  const { t } = useTranslation()
  const { state, toggleRoute, setActiveEndpointKey } = useOpenAPIContext()
  const { openShareDialog } = useShareDialog()
  const isSelected = state.selectedRoutes.has(index)
  const routeKey = getParsedRouteKey(route)
  const isOpen = state.activeEndpointKey === routeKey

  const handleOpenChange = useCallback((open: boolean) => {
    setActiveEndpointKey(open ? routeKey : "")
  }, [routeKey, setActiveEndpointKey])

  const copyText = useMemo(() => formatMarkdown(route), [route])

  const handleCheckChange = useCallback((checked: boolean | "indeterminate") => {
    if (checked === "indeterminate") return
    // Only toggle if the state actually differs
    if (checked !== isSelected) {
      toggleRoute(index)
    }
  }, [index, isSelected, toggleRoute])

  const handleShare = useCallback(() => {
    openShareDialog({
      type: "endpoint",
      endpointKey: routeKey,
      label: `${route.method.toUpperCase()} ${route.path}`,
    })
  }, [openShareDialog, route.method, route.path, routeKey])

  const summary = (route.summary || route.description || "").substring(0, 80)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
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
                    size="sm"
                    className="size-4"
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

                <PathTemplate path={route.path} />

                {route.security?.length > 0 && route.security.some(s => Object.keys(s).length > 0) && (
                  <span title={t("endpoints.authRequired")}><Lock className="size-3 text-muted-foreground shrink-0" /></span>
                )}

                <EnvPresenceDots routeKey={routeKey} />

                {summary && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    {summary}
                  </span>
                )}

                <div className="flex-1" />

                {onToggleFavorite && (
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => { e.stopPropagation(); onToggleFavorite(routeKey) }}
                    title={isFavorite ? t("favorites.remove") : t("favorites.add")}
                  >
                    <Star className={cn("size-3.5", isFavorite && "fill-amber-400 text-amber-400")} />
                  </button>
                )}

                <CopyButton
                  variant="ghost"
                  size="xs"
                  content={copyText}
                  onClick={e => e.stopPropagation()}
                  onCopiedChange={(copied) => { if (copied) toast.success(t("toast.copied")) }}
                  className="shrink-0"
                />

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
                {isOpen && <RouteDetail route={route} index={index} />}
              </div>
            </AnimatedCollapsibleContent>
          </Collapsible>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleShare}>
          <Share2 data-icon="inline-start" />
          {t("share.menuItem")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

const STATUS_COLORS: Record<InferredStatus & string, string> = {
  online: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  testing: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  inDev: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  localOnly: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  teammate: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
}

const STATUS_I18N: Record<InferredStatus & string, string> = {
  online: "envStatus.online",
  testing: "envStatus.testing",
  inDev: "envStatus.inDev",
  localOnly: "envStatus.localOnly",
  teammate: "envStatus.teammate",
}

function EnvPresenceDots({ routeKey }: { routeKey: string }) {
  const { t } = useTranslation()
  const multiEnv = useMultiEnvStatus()

  if (!multiEnv.enabled || multiEnv.envStatuses.length === 0) return null

  const presence = multiEnv.getRoutePresence(routeKey)
  const status = multiEnv.inferStatus(routeKey)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 shrink-0">
        {presence.map(p => (
          <Tooltip key={p.envId}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  p.status === "error" ? "bg-destructive" :
                  p.present ? "bg-emerald-500" : "bg-muted-foreground/30",
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <span className="font-medium">{p.envName}</span>
              {" — "}
              {p.status === "error" ? t("envStatus.error") :
               p.present ? t("envStatus.present") : t("envStatus.absent")}
            </TooltipContent>
          </Tooltip>
        ))}
        {status && (
          <Badge
            variant="outline"
            className={cn("text-[9px] px-1 py-0 border", STATUS_COLORS[status])}
          >
            {t(STATUS_I18N[status])}
          </Badge>
        )}
      </div>
    </TooltipProvider>
  )
}
