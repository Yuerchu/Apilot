import { useMemo, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { getParsedRouteKey } from "@/lib/openapi/route-key"
import { useFavorites } from "@/hooks/use-favorites"
import { Star } from "@/components/animate-ui/icons/star"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { RouteCard } from "./RouteCard"

export function FavoritesView() {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const { routes } = state
  const { favorites, isFavorite, toggleFavorite } = useFavorites()

  const favoriteRoutes = useMemo(() => {
    return routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) => isFavorite(getParsedRouteKey(route)))
  }, [routes, favorites, isFavorite])

  const activeRouteRowIndex = useMemo(() => {
    if (!state.activeEndpointKey) return -1
    return favoriteRoutes.findIndex(({ route }) => getParsedRouteKey(route) === state.activeEndpointKey)
  }, [state.activeEndpointKey, favoriteRoutes])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: favoriteRoutes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 15,
  })

  useEffect(() => {
    if (activeRouteRowIndex < 0) return
    virtualizer.scrollToIndex(activeRouteRowIndex, { align: "center" })
  }, [activeRouteRowIndex, virtualizer])

  if (favoriteRoutes.length === 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Star />
          </EmptyMedia>
          <EmptyTitle>{t("favoritesView.empty")}</EmptyTitle>
          <EmptyDescription>{t("favoritesView.emptyDesc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center gap-2 px-1">
        <Star size={16} className="fill-amber-400 text-amber-400" />
        <span className="text-xs text-muted-foreground">
          {t("favoritesView.count", { count: favoriteRoutes.length })}
        </span>
      </div>

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
            const item = favoriteRoutes[virtualRow.index]
            if (!item) return null
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
                <div className="pb-2">
                  <RouteCard
                    route={item.route}
                    index={item.index}
                    isFavorite={true}
                    onToggleFavorite={toggleFavorite}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
