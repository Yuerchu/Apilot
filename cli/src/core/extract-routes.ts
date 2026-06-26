import type {
  OpenAPISpec,
  ParsedRoute,
  TagInfo,
  ModelRouteMap,
} from "@/lib/openapi/types"
import {
  HTTP_METHODS,
  collectModelRefs,
  buildModelRouteMap,
} from "@/lib/openapi/parser"

export function extractRoutes(spec: OpenAPISpec, sourceSpec: OpenAPISpec): {
  routes: ParsedRoute[]
  allTags: TagInfo[]
  modelRouteMap: ModelRouteMap
} {
  const routes: ParsedRoute[] = []
  const tagSet = new Set<string>()
  const tagCounts: Record<string, number> = {}

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    const sourcePathItem = sourceSpec.paths?.[path]
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue
      const tags = op.tags || ["Ungrouped"]
      tags.forEach(t => {
        tagSet.add(t)
        tagCounts[t] = (tagCounts[t] || 0) + 1
      })

      const refs = new Set<string>()
      collectModelRefs(sourcePathItem?.[method] || op, refs)

      routes.push({
        method,
        path,
        tags,
        summary: op.summary || "",
        description: op.description || "",
        operationId: op.operationId || "",
        parameters: [...(pathItem.parameters || []), ...(op.parameters || [])],
        requestBody: op.requestBody || null,
        responses: op.responses || {},
        security: op.security || spec.security || [],
        selected: false,
        referencedModels: [...refs],
      })
    }
  }

  const allTags: TagInfo[] = [...tagSet].map(name => ({ name, count: tagCounts[name] || 0 }))
  const modelRouteMap = buildModelRouteMap(routes)
  return { routes, allTags, modelRouteMap }
}
