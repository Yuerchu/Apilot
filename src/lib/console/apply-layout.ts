import type { SchemaObject } from "@/lib/openapi/types"
import type { FormFieldConfig, DetailFieldConfig, StatsConfig, SearchConfig } from "./types"

/**
 * Apply a FormFieldConfig[] to a schema: filter hidden fields, reorder properties,
 * apply label → title and widgetType → x-widget overrides, and drop hidden fields
 * from `required` so ajv doesn't complain about invisible fields.
 *
 * Shared by ConsoleFormDialog, form-like templates, and the Builder preview so
 * the editor and the runtime render the exact same schema.
 */
export function applyFieldLayout(schema: SchemaObject, fieldConfigs: FormFieldConfig[] | undefined): SchemaObject {
  if (!fieldConfigs || fieldConfigs.length === 0 || !schema.properties) return schema
  const configMap = new Map(fieldConfigs.map(f => [f.field, f]))
  const visibleFields = fieldConfigs
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order)
    .map(f => f.field)
    .filter(f => f in schema.properties!)

  const newFields = Object.keys(schema.properties).filter(f => !configMap.has(f))
  const hiddenFields = new Set(
    fieldConfigs.filter(f => !f.visible).map(f => f.field),
  )

  const orderedKeys = [...visibleFields, ...newFields]
  const newProperties: Record<string, SchemaObject> = {}
  for (const key of orderedKeys) {
    if (schema.properties[key]) {
      const cfg = configMap.get(key)
      const prop = schema.properties[key]
      newProperties[key] = cfg?.label || cfg?.widgetType
        ? {
          ...prop,
          ...(cfg.label ? { title: cfg.label } : {}),
          ...(cfg.widgetType ? { "x-widget": cfg.widgetType } : {}),
        }
        : prop
    }
  }

  const result: SchemaObject = { ...schema, properties: newProperties }
  if (schema.required) {
    result.required = schema.required.filter(r => !hiddenFields.has(r))
  }
  return result
}

export interface DetailRow {
  key: string
  label: string
  value: unknown
}

/**
 * Apply a DetailFieldConfig[] to a key-value object: order and filter rows,
 * apply label overrides. Unknown keys (not in the config) are appended in
 * data order so new API fields still show up.
 */
export function applyDetailLayout(data: Record<string, unknown>, fieldConfigs: DetailFieldConfig[] | undefined): DetailRow[] {
  const dataKeys = Object.keys(data)
  if (!fieldConfigs || fieldConfigs.length === 0) {
    return dataKeys.map(key => ({ key, label: key, value: data[key] }))
  }

  const configMap = new Map(fieldConfigs.map(f => [f.field, f]))
  const ordered = fieldConfigs
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order)
    .map(f => f.field)
    .filter(f => f in data)
  const unknown = dataKeys.filter(k => !configMap.has(k))

  return [...ordered, ...unknown].map(key => ({
    key,
    label: configMap.get(key)?.label || key,
    value: data[key],
  }))
}

export interface StatCard {
  key: string
  label: string
  value: number
}

export interface ChartDataPoint {
  label: string
  value: number
}

function humanizeKey(key: string): string {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Categorize numeric fields of a stats response into stat cards + chart data,
 * honoring StatsConfig (excludeFields, fieldLabels).
 */
export function categorizeStats(
  data: Record<string, unknown> | null,
  config: StatsConfig | undefined,
): { statCards: StatCard[]; chartData: ChartDataPoint[] } {
  if (!data || Array.isArray(data)) return { statCards: [], chartData: [] }
  const excluded = new Set(config?.excludeFields ?? [])
  const statCards: StatCard[] = []
  const chartData: ChartDataPoint[] = []

  for (const [key, value] of Object.entries(data)) {
    if (excluded.has(key)) continue
    let num: number | null = null
    if (typeof value === "number" && Number.isFinite(value)) {
      num = value
    } else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) num = parsed
    }
    if (num === null) continue
    const label = config?.fieldLabels?.[key] || humanizeKey(key)
    statCards.push({ key, label, value: num })
    chartData.push({ label, value: num })
  }

  return { statCards, chartData }
}

const TITLE_CANDIDATES = ["name", "title", "label", "id"]
const DESC_CANDIDATES = ["description", "summary", "text"]

/**
 * Pick title/description/badge fields for a search result card,
 * honoring SearchConfig overrides over the built-in heuristics.
 */
export function pickSearchFields(
  item: Record<string, unknown>,
  config: SearchConfig | undefined,
): { title: string; desc: string; badges: Array<[string, unknown]> } {
  const pick = (explicit: string | undefined, candidates: string[]): string => {
    if (explicit && explicit in item) return String(item[explicit] ?? "")
    for (const c of candidates) {
      if (item[c] !== undefined && item[c] !== null) return String(item[c])
    }
    return ""
  }

  const title = pick(config?.titleField, TITLE_CANDIDATES)
  const desc = pick(config?.descField, DESC_CANDIDATES)

  const badgeKeys = config?.badgeFields && config.badgeFields.length > 0
    ? config.badgeFields.filter(k => k in item)
    : Object.keys(item).slice(0, 5)
  const badges: Array<[string, unknown]> = badgeKeys
    .map(k => [k, item[k]] as [string, unknown])
    .filter(([, v]) => typeof v !== "object" || v === null)

  return { title, desc, badges }
}
