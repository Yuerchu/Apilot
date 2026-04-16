import type { ParsedRoute } from "./types"

export function getRouteKey(method: string, path: string): string {
  return `${method.toLowerCase()}:${path}`
}

export function getParsedRouteKey(route: ParsedRoute): string {
  return getRouteKey(route.method, route.path)
}
