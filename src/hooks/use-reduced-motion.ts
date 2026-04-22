import { useSyncExternalStore } from "react"

export type MotionPreference = "system" | "always" | "reduced"

const LS_KEY = "oa_reducedMotion"

function getSnapshot(): MotionPreference {
  const v = localStorage.getItem(LS_KEY)
  if (v === "always" || v === "reduced") return v
  return "system"
}

function getServerSnapshot(): MotionPreference {
  return "system"
}

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function setMotionPreference(v: MotionPreference) {
  localStorage.setItem(LS_KEY, v)
  for (const cb of listeners) cb()
}

export function useMotionPreference() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [preference, setMotionPreference] as const
}

/**
 * Maps the user preference to Motion's `reducedMotion` prop value.
 * - "system" → "user" (respect OS setting)
 * - "always" → "never" (never reduce, always animate)
 * - "reduced" → "always" (always reduce motion)
 */
export function toMotionReducedMotion(pref: MotionPreference): "user" | "never" | "always" {
  switch (pref) {
    case "always": return "never"
    case "reduced": return "always"
    default: return "user"
  }
}
