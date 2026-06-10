import type { ParsedRoute } from "@/lib/openapi/types"
import type { ConsoleResource, ConsoleResourceGroup, CrudOp, DiagnosticHint, PageType, ResourceAction } from "./types"
import { inferListItemSchema, inferDetailSchema, inferCreateSchema, inferUpdateSchema } from "./schema-inference"

interface PathSegment {
  raw: string
  isParam: boolean
  paramName: string | null
}

function parseSegments(path: string): PathSegment[] {
  return path.split("/").filter(Boolean).map(seg => {
    const m = seg.match(/^\{(.+)\}$/)
    return { raw: seg, isParam: !!m, paramName: m?.[1] ?? null }
  })
}

function toPath(segments: PathSegment[]): string {
  return "/" + segments.map(s => s.raw).join("/")
}

function getResourceName(collectionPath: string): string {
  const parts = collectionPath.split("/").filter(Boolean)
  return [...parts].reverse().find(s => !s.startsWith("{")) ?? parts[parts.length - 1] ?? collectionPath
}

function isPathLikeTag(tag: string): boolean {
  return tag.includes("/") || tag.includes("{")
}

function getDisplayName(name: string, tag: string | null): string {
  if (tag && !isPathLikeTag(tag)) return tag
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

interface RouteEntry {
  route: ParsedRoute
  index: number
  segments: PathSegment[]
  path: string
}

/**
 * Core collection detection. A "collection" is the base path of a REST resource.
 *
 * Strategy (ordered):
 * 1. Any route `path/{param}` implies `path` is a collection (even if no route at `path` exists)
 * 2. A path with both GET and POST (and no param as last segment) is a collection
 * 3. A path with GET only (no param as last) is a read-only collection
 * 4. Everything else that is a sub-path of `collection/{param}/...` is an action, not a collection
 * 5. Standalone POST-only paths (like `/auth/login`) are NOT collections — they become orphans
 */
function identifyCollections(entries: RouteEntry[]): Set<string> {
  const methodsByPath = new Map<string, Set<string>>()
  for (const e of entries) {
    const ms = methodsByPath.get(e.path) ?? new Set()
    ms.add(e.route.method.toUpperCase())
    methodsByPath.set(e.path, ms)
  }

  const collections = new Set<string>()

  // Pass 1: Any `.../{param}` route implies the parent is a collection
  for (const e of entries) {
    const segs = e.segments
    if (segs.length >= 2 && segs.at(-1)!.isParam) {
      collections.add(toPath(segs.slice(0, -1)))
    }
  }

  // Pass 2: Paths with GET or POST that look like collections (sorted for deterministic results)
  const sortedPaths = [...methodsByPath.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [path, methods] of sortedPaths) {
    const segs = parseSegments(path)
    if (segs.length === 0 || segs.at(-1)!.isParam) continue
    if (collections.has(path)) continue
    if (!methods.has("GET")) continue
    // Paths with both GET and POST are always collections (even nested ones)
    const hasBoth = methods.has("GET") && methods.has("POST")
    if (!hasBoth && isSubAction(path, collections)) continue
    collections.add(path)
  }

  return collections
}

function isSubAction(path: string, collections: Set<string>): boolean {
  const segs = parseSegments(path)
  // Walk up from the path to find if any ancestor is a collection
  // /users/{id}/activate → check /users/{id} (not a collection, it's an item), then /users (collection!) → yes
  for (let i = segs.length - 1; i >= 1; i--) {
    const prefix = toPath(segs.slice(0, i))
    if (segs[i - 1]!.isParam && i >= 2) {
      const grandparent = toPath(segs.slice(0, i - 1))
      if (collections.has(grandparent)) return true
    }
    if (collections.has(prefix)) return true
  }
  return false
}

function bestCollection(entry: RouteEntry, collections: Set<string>): string | null {
  const segs = entry.segments
  if (collections.has(entry.path)) return entry.path

  // item route: collection/{param}
  if (segs.length >= 2 && segs.at(-1)!.isParam) {
    const parent = toPath(segs.slice(0, -1))
    if (collections.has(parent)) return parent
  }

  // sub-path: walk up to find closest collection
  for (let i = segs.length - 1; i >= 1; i--) {
    if (segs[i - 1]!.isParam && i >= 2) {
      const coll = toPath(segs.slice(0, i - 1))
      if (collections.has(coll)) return coll
    }
    const prefix = toPath(segs.slice(0, i))
    if (collections.has(prefix)) return prefix
  }

  return null
}

function methodToCrud(method: string, isCollection: boolean, isItem: boolean): CrudOp | null {
  const m = method.toUpperCase()
  if (m === "GET" && isCollection) return "list"
  if (m === "GET" && isItem) return "read"
  if (m === "POST" && isCollection) return "create"
  if (m === "PUT" && isItem) return "update"
  if (m === "PATCH" && isItem) return "update"
  if (m === "DELETE" && isItem) return "delete"
  return null
}

export function groupRoutes(routes: ParsedRoute[]): ConsoleResource[] {
  const entries: RouteEntry[] = routes.map((route, index) => {
    const segments = parseSegments(route.path)
    return { route, index, segments, path: toPath(segments) }
  })

  const collections = identifyCollections(entries)

  const resData = new Map<string, {
    operations: Partial<Record<CrudOp, ResourceAction>>
    actions: ResourceAction[]
    tag: string | null
    idParam: string | null
  }>()

  for (const coll of collections) {
    resData.set(coll, { operations: {}, actions: [], tag: null, idParam: null })
  }

  const orphans: RouteEntry[] = []

  for (const entry of entries) {
    const coll = bestCollection(entry, collections)
    if (!coll) {
      orphans.push(entry)
      continue
    }

    const rd = resData.get(coll)!
    if (!rd.tag && entry.route.tags.length > 0) {
      rd.tag = entry.route.tags[0] ?? null
    }

    const collSegCount = coll.split("/").filter(Boolean).length
    const isExact = entry.path === coll
    const isItem = entry.segments.length === collSegCount + 1 && entry.segments[collSegCount]?.isParam === true

    if (isItem && !rd.idParam) {
      rd.idParam = entry.segments[collSegCount]?.paramName ?? null
    }

    const crudOp = methodToCrud(entry.route.method, isExact, isItem)

    if (crudOp && (isExact || isItem)) {
      if (rd.operations[crudOp] && crudOp === "update") {
        if (entry.route.method.toUpperCase() === "PATCH") {
          rd.operations[crudOp] = makeAction(entry, crudOp)
        }
      } else if (!rd.operations[crudOp]) {
        rd.operations[crudOp] = makeAction(entry, crudOp)
      }
    } else {
      // Nested collection routes are attached to their own resource, not parent
      if (collections.has(entry.path) && entry.path !== coll) continue
      rd.actions.push(makeAction(entry, null))
    }
  }

  const resources: ConsoleResource[] = []

  for (const [collectionPath, rd] of resData) {
    const name = getResourceName(collectionPath)
    const displayName = getDisplayName(name, rd.tag)

    const listItemSchema = rd.operations.list ? inferListItemSchema(rd.operations.list.route).schema : null
    const detailSchema = rd.operations.read ? inferDetailSchema(rd.operations.read.route) : null
    const createSchema = rd.operations.create ? inferCreateSchema(rd.operations.create.route) : null
    const updateSchema = rd.operations.update ? inferUpdateSchema(rd.operations.update.route) : null

    const hints: DiagnosticHint[] = []
    if (!rd.operations.list) {
      hints.push({
        code: "missing-list-endpoint",
        message: `Resource "${name}" has no GET ${collectionPath} endpoint`,
        suggestion: `Add a GET ${collectionPath} endpoint or hide this resource in .apilot`,
        resource: name,
      })
    }
    if (rd.operations.create && !createSchema) {
      hints.push({
        code: "missing-create-schema",
        message: `POST ${collectionPath} has no request body schema`,
        suggestion: "Add a requestBody schema to the OpenAPI spec",
        resource: name,
      })
    }
    if (!rd.idParam && (rd.operations.read || rd.operations.update || rd.operations.delete)) {
      hints.push({
        code: "missing-id-param",
        message: `Cannot detect ID parameter for "${name}"`,
        suggestion: "Ensure item endpoints use a path parameter like {id}",
        resource: name,
      })
    }

    // Detect parent collection
    let parent: string | null = null
    const segs = parseSegments(collectionPath)
    for (let i = segs.length - 1; i >= 1; i--) {
      if (segs[i - 1]!.isParam && i >= 2) {
        const candidate = toPath(segs.slice(0, i - 1))
        if (collections.has(candidate)) { parent = candidate; break }
      }
    }

    const crudCount = Object.keys(rd.operations).length
    const confidence = Math.min(1, crudCount * 0.25 + (listItemSchema ? 0.15 : 0) + (rd.idParam ? 0.1 : 0))
    const pageType = inferPageType(rd.operations, rd.actions)

    resources.push({
      name, displayName, basePath: collectionPath, tag: rd.tag, idParam: rd.idParam,
      pageType, operations: rd.operations, actions: rd.actions,
      listItemSchema, createSchema, updateSchema, detailSchema,
      confidence, hints, parent,
    })
  }

  // Orphans: try to attach to a resource with the same tag, otherwise standalone
  for (const entry of orphans) {
    const label = entry.route.summary || entry.route.operationId || `${entry.route.method} ${entry.route.path}`
    const tag = entry.route.tags[0] ?? null

    let attached = false
    if (tag) {
      const target = resources.find(r => r.tag === tag)
      if (target) {
        target.actions.push(makeAction(entry, null))
        attached = true
      }
    }

    if (!attached) {
      resources.push({
        name: entry.route.operationId || entry.route.path.replace(/\//g, "_").replace(/^_/, ""),
        displayName: label,
        basePath: entry.route.path,
        tag,
        idParam: null,
        pageType: "action" as PageType,
        operations: {},
        actions: [makeAction(entry, null)],
        listItemSchema: null, createSchema: null, updateSchema: null, detailSchema: null,
        confidence: 0.2,
        hints: [{
          code: "non-restful-endpoint",
          message: `Endpoint ${entry.route.method} ${entry.route.path} does not match a RESTful pattern`,
          suggestion: "Configure this endpoint in .apilot as a standalone action or hide it",
          resource: entry.route.operationId ?? entry.route.path,
        }],
        parent: null,
      })
    }
  }

  return resources.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
}

function inferPageType(
  operations: Partial<Record<CrudOp, ResourceAction>>,
  _actions: ResourceAction[],
): PageType {
  const has = (op: CrudOp) => !!operations[op]
  if (has("list")) return "table"
  if (has("read") && has("update")) return "editor"
  if (has("read")) return "detail"
  if (has("create") && !has("list")) return "form"
  return "action"
}

function makeAction(entry: RouteEntry, crudOp: CrudOp | null): ResourceAction {
  const base = {
    route: entry.route,
    routeIndex: entry.index,
    label: entry.route.summary || entry.route.operationId || `${entry.route.method} ${entry.route.path}`,
    kind: (crudOp ? "crud" : "action") as "crud" | "action",
  }
  return crudOp ? { ...base, crudOp } : base
}

export function groupResourcesByTag(resources: ConsoleResource[]): ConsoleResourceGroup[] {
  const groupMap = new Map<string, ConsoleResource[]>()
  for (const resource of resources) {
    const label = resource.tag ?? "Other"
    const arr = groupMap.get(label) ?? []
    arr.push(resource)
    groupMap.set(label, arr)
  }
  return Array.from(groupMap.entries())
    .map(([label, res]) => ({ label, resources: res }))
    .sort((a, b) => {
      if (a.label === "Other") return 1
      if (b.label === "Other") return -1
      return a.label.localeCompare(b.label)
    })
}

const COMMON_PREFIXES = new Set(["api", "v1", "v2", "v3", "v4"])

function extractGroupPrefix(basePath: string): string {
  const parts = basePath.split("/").filter(Boolean).filter(s => !s.startsWith("{"))
  // Skip common API version prefixes
  let start = 0
  while (start < parts.length && COMMON_PREFIXES.has(parts[start]!.toLowerCase())) {
    start++
  }
  // Use the first meaningful segment as group name
  if (start < parts.length) {
    return parts[start]!
  }
  return parts[parts.length - 1] ?? basePath
}

export function groupResourcesByPrefix(resources: ConsoleResource[]): ConsoleResourceGroup[] {
  const groupMap = new Map<string, ConsoleResource[]>()

  for (const resource of resources) {
    const prefix = extractGroupPrefix(resource.basePath)
    const arr = groupMap.get(prefix) ?? []
    arr.push(resource)
    groupMap.set(prefix, arr)
  }

  return Array.from(groupMap.entries())
    .map(([label, res]) => ({ label, resources: res }))
    .sort((a, b) => b.resources.length - a.resources.length || a.label.localeCompare(b.label))
}
