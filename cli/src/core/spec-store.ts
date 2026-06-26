import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import YAML from "yaml"
import {
  parseSpecText,
  parseValidatedSpec,
  normalizeParsedSpec,
} from "@/lib/openapi/parser"
import { computeSpecId } from "@/lib/spec-id"
import type {
  OpenAPISpec,
  ParsedRoute,
  TagInfo,
  ModelRouteMap,
} from "@/lib/openapi/types"
import { extractRoutes } from "./extract-routes"

export interface LoadedSpec {
  id: string
  title: string
  version: string
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec
  routes: ParsedRoute[]
  allTags: TagInfo[]
  modelRouteMap: ModelRouteMap
  source: string
}

export class SpecStore {
  private cache = new Map<string, LoadedSpec>()

  async load(source: string, baseDir?: string): Promise<LoadedSpec> {
    const resolvedSource = this.resolveSource(source, baseDir)

    let raw: OpenAPISpec
    if (/^https?:\/\//i.test(resolvedSource)) {
      const res = await fetch(resolvedSource)
      if (!res.ok) throw new Error(`Failed to fetch spec: HTTP ${res.status}`)
      const text = await res.text()
      raw = parseSpecText(text)
    } else {
      if (!existsSync(resolvedSource)) {
        throw new Error(`Spec file not found: ${resolvedSource}`)
      }
      const text = readFileSync(resolvedSource, "utf8")
      raw = parseSpecText(text)
    }

    const { spec: parsed, sourceSpec } = await parseValidatedSpec(raw, {
      sourceUrl: /^https?:\/\//i.test(resolvedSource) ? resolvedSource : undefined,
    })
    const spec = normalizeParsedSpec(parsed)
    const { routes, allTags, modelRouteMap } = extractRoutes(spec, sourceSpec)
    const id = computeSpecId(spec, resolvedSource)

    const loaded: LoadedSpec = {
      id,
      title: spec.info?.title || "Untitled",
      version: spec.info?.version || "0",
      spec,
      sourceSpec,
      routes,
      allTags,
      modelRouteMap,
      source: resolvedSource,
    }

    this.cache.set(id, loaded)
    return loaded
  }

  get(id: string): LoadedSpec | undefined {
    return this.cache.get(id)
  }

  list(): Array<{ id: string; title: string; version: string; routeCount: number; tagCount: number }> {
    return [...this.cache.values()].map(s => ({
      id: s.id,
      title: s.title,
      version: s.version,
      routeCount: s.routes.length,
      tagCount: s.allTags.length,
    }))
  }

  getOnly(): LoadedSpec | undefined {
    if (this.cache.size === 1) return this.cache.values().next().value
    return undefined
  }

  unload(id: string): boolean {
    return this.cache.delete(id)
  }

  private resolveSource(source: string, baseDir?: string): string {
    if (/^https?:\/\//i.test(source)) return source
    const base = baseDir || process.cwd()
    return resolve(base, source)
  }
}
