import { useState, useEffect, useRef } from "react"

/**
 * Progressively renders a large list — shows the first `initialCount` items
 * immediately, then adds `batchSize` items per animation frame until all
 * items are visible.
 */
export function useProgressiveRender<T>(
  items: T[],
  initialCount = 20,
  batchSize = 30,
): { visible: T[]; isComplete: boolean } {
  const [visibleCount, setVisibleCount] = useState(initialCount)
  const prevItemsRef = useRef(items)

  // Reset when items array changes (new filter / new spec)
  useEffect(() => {
    if (prevItemsRef.current !== items) {
      prevItemsRef.current = items
      setVisibleCount(initialCount)
    }
  }, [items, initialCount])

  // Progressively load more
  useEffect(() => {
    if (visibleCount >= items.length) return
    const id = requestAnimationFrame(() => {
      setVisibleCount(v => Math.min(v + batchSize, items.length))
    })
    return () => cancelAnimationFrame(id)
  }, [visibleCount, items.length, batchSize])

  return {
    visible: items.slice(0, visibleCount),
    isComplete: visibleCount >= items.length,
  }
}
