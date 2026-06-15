import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { getFavorites, addFavorite, removeFavorite } from "@/lib/db"

export interface FavoritesContextValue {
  favorites: Set<string>
  isFavorite: (routeKey: string) => boolean
  toggleFavorite: (routeKey: string) => void
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null)

const EMPTY_SET = new Set<string>()

export function useFavoritesProvider(): FavoritesContextValue {
  const specId = useSpecId()
  const [favorites, setFavorites] = useState<Set<string>>(EMPTY_SET)
  const [loadedSpecId, setLoadedSpecId] = useState<string | null>(null)

  useEffect(() => {
    if (!specId) return
    let cancelled = false
    getFavorites(specId).then(result => {
      if (!cancelled) {
        setFavorites(result)
        setLoadedSpecId(specId)
      }
    })
    return () => { cancelled = true }
  }, [specId])

  // Derive empty when specId is absent or changed but not yet loaded
  const effectiveFavorites = !specId || loadedSpecId !== specId ? EMPTY_SET : favorites

  const isFavorite = useCallback((routeKey: string) => effectiveFavorites.has(routeKey), [effectiveFavorites])

  const toggleFavorite = useCallback((routeKey: string) => {
    if (!specId) return
    const wasFavorite = effectiveFavorites.has(routeKey)
    // Optimistic, functional update (avoids stale-snapshot overwrites on rapid toggles).
    const apply = (add: boolean) => setFavorites(prev => {
      const next = new Set(prev)
      if (add) next.add(routeKey)
      else next.delete(routeKey)
      return next
    })
    apply(!wasFavorite)
    const op = wasFavorite ? removeFavorite(specId, routeKey) : addFavorite(specId, routeKey)
    op.catch(() => apply(wasFavorite)) // roll back on persistence failure
  }, [specId, effectiveFavorites])

  return { favorites: effectiveFavorites, isFavorite, toggleFavorite }
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider")
  return ctx
}
