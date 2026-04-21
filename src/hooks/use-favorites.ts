import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { getFavorites, addFavorite, removeFavorite } from "@/lib/db"

export interface FavoritesContextValue {
  favorites: Set<string>
  isFavorite: (routeKey: string) => boolean
  toggleFavorite: (routeKey: string) => void
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function useFavoritesProvider(): FavoritesContextValue {
  const specId = useSpecId()
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!specId) { setFavorites(new Set()); return }
    getFavorites(specId).then(setFavorites)
  }, [specId])

  const isFavorite = useCallback((routeKey: string) => favorites.has(routeKey), [favorites])

  const toggleFavorite = useCallback((routeKey: string) => {
    if (!specId) return
    const next = new Set(favorites)
    if (next.has(routeKey)) {
      next.delete(routeKey)
      removeFavorite(specId, routeKey)
    } else {
      next.add(routeKey)
      addFavorite(specId, routeKey)
    }
    setFavorites(next)
  }, [specId, favorites])

  return { favorites, isFavorite, toggleFavorite }
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider")
  return ctx
}
