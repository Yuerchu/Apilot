import { useState, useEffect, useCallback } from "react"
import { useSpecId } from "@/hooks/use-spec-id"
import { getFavorites, addFavorite, removeFavorite } from "@/lib/db"

export function useFavorites() {
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
