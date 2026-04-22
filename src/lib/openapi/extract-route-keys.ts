const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"]

/**
 * Lightweight route key extraction from a raw spec object.
 * Does not validate or dereference — just iterates paths and methods.
 */
export function extractRouteKeys(rawSpec: Record<string, unknown>): Set<string> {
  const paths = rawSpec.paths
  if (!paths || typeof paths !== "object") return new Set()

  const keys = new Set<string>()
  for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== "object") continue
    for (const method of HTTP_METHODS) {
      if (method in (pathItem as Record<string, unknown>)) {
        keys.add(`${method}:${path}`)
      }
    }
  }
  return keys
}
