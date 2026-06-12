import { getDB } from "@/lib/db"
import { PAGE_TEMPLATES } from "./templates"
import type { ResourceLayout, ColumnConfig, FormFieldConfig, DetailFieldConfig, StatsConfig, SearchConfig } from "./types"

export interface ApilotConfig {
  $schema?: string | undefined
  version: 1
  resources: Record<string, ResourceLayout>
}

interface LayoutRecord {
  id: string
  specId: string
  basePath: string
  layout: ResourceLayout
  updatedAt: number
}

function makeId(specId: string, basePath: string): string {
  return `${specId}::${basePath}`
}

export async function saveLayout(specId: string, basePath: string, layout: ResourceLayout): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames.contains("consoleLayouts")) return
  const record: LayoutRecord = {
    id: makeId(specId, basePath),
    specId,
    basePath,
    layout,
    updatedAt: Date.now(),
  }
  await db.put("consoleLayouts", record)
}

export async function loadLayouts(specId: string): Promise<Record<string, ResourceLayout>> {
  const db = await getDB()
  if (!db.objectStoreNames.contains("consoleLayouts")) return {}
  const records: LayoutRecord[] = await db.getAllFromIndex("consoleLayouts", "specId", specId)
  const result: Record<string, ResourceLayout> = {}
  for (const r of records) {
    result[r.basePath] = r.layout
  }
  return result
}

export async function deleteLayout(specId: string, basePath: string): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames.contains("consoleLayouts")) return
  await db.delete("consoleLayouts", makeId(specId, basePath))
}

export function exportApilotConfig(layouts: Record<string, ResourceLayout>): ApilotConfig {
  return {
    $schema: "https://openapi.yxqi.cn/schemas/apilot-v1.json",
    version: 1,
    resources: layouts,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function sanitizeFieldConfig(v: unknown): { field: string; visible: boolean; order: number; label?: string; widgetType?: string } | null {
  if (!isRecord(v)) return null
  if (typeof v.field !== "string" || typeof v.visible !== "boolean" || typeof v.order !== "number") return null
  const out: { field: string; visible: boolean; order: number; label?: string; widgetType?: string } = {
    field: v.field,
    visible: v.visible,
    order: v.order,
  }
  if (typeof v.label === "string" && v.label) out.label = v.label
  if (typeof v.widgetType === "string" && v.widgetType) out.widgetType = v.widgetType
  return out
}

function sanitizeColumnConfig(v: unknown): ColumnConfig | null {
  const base = sanitizeFieldConfig(v)
  if (!base) return null
  const rec = v as Record<string, unknown>
  const out: ColumnConfig = { field: base.field, visible: base.visible, order: base.order }
  if (typeof rec.headerLabel === "string" && rec.headerLabel) out.headerLabel = rec.headerLabel
  if (typeof rec.width === "number" && rec.width > 0) out.width = rec.width
  if (rec.pinned === "left" || rec.pinned === "right") out.pinned = rec.pinned
  return out
}

function sanitizeArray<T>(v: unknown, sanitize: (item: unknown) => T | null): T[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.map(sanitize).filter((x): x is T => x !== null)
  return out.length > 0 ? out : undefined
}

const VALID_TEMPLATE_IDS = new Set(PAGE_TEMPLATES.map(t => t.id))
const VALID_CHART_TYPES = new Set(["bar", "line", "area"])

function sanitizeLayout(v: unknown): ResourceLayout | null {
  if (!isRecord(v)) return null
  const layout: ResourceLayout = {}

  const columns = sanitizeArray(v.columns, sanitizeColumnConfig)
  if (columns) layout.columns = columns
  const createFields = sanitizeArray(v.createFields, sanitizeFieldConfig) as FormFieldConfig[] | undefined
  if (createFields) layout.createFields = createFields
  const updateFields = sanitizeArray(v.updateFields, sanitizeFieldConfig) as FormFieldConfig[] | undefined
  if (updateFields) layout.updateFields = updateFields
  const formFields = sanitizeArray(v.formFields, sanitizeFieldConfig) as FormFieldConfig[] | undefined
  if (formFields) layout.formFields = formFields
  const detailFields = sanitizeArray(v.detailFields, sanitizeFieldConfig) as DetailFieldConfig[] | undefined
  if (detailFields) layout.detailFields = detailFields.map(({ field, visible, order, label }) => ({ field, visible, order, ...(label ? { label } : {}) }))

  if (isRecord(v.statsConfig)) {
    const sc = v.statsConfig
    const stats: StatsConfig = {}
    if (Array.isArray(sc.excludeFields)) {
      const fields = sc.excludeFields.filter((f): f is string => typeof f === "string")
      if (fields.length > 0) stats.excludeFields = fields
    }
    if (typeof sc.chartType === "string" && VALID_CHART_TYPES.has(sc.chartType)) stats.chartType = sc.chartType as StatsConfig["chartType"]
    if (typeof sc.chartHeight === "number" && sc.chartHeight > 0) stats.chartHeight = sc.chartHeight
    if (isRecord(sc.fieldLabels)) {
      const labels: Record<string, string> = {}
      for (const [k, lv] of Object.entries(sc.fieldLabels)) {
        if (typeof lv === "string") labels[k] = lv
      }
      if (Object.keys(labels).length > 0) stats.fieldLabels = labels
    }
    if (Object.keys(stats).length > 0) layout.statsConfig = stats
  }

  if (isRecord(v.searchConfig)) {
    const sc = v.searchConfig
    const search: SearchConfig = {}
    if (typeof sc.titleField === "string" && sc.titleField) search.titleField = sc.titleField
    if (typeof sc.descField === "string" && sc.descField) search.descField = sc.descField
    if (Array.isArray(sc.badgeFields)) {
      const fields = sc.badgeFields.filter((f): f is string => typeof f === "string")
      if (fields.length > 0) search.badgeFields = fields
    }
    if (Object.keys(search).length > 0) layout.searchConfig = search
  }

  if (typeof v.displayNameOverride === "string" && v.displayNameOverride) layout.displayNameOverride = v.displayNameOverride
  if (typeof v.templateId === "string" && VALID_TEMPLATE_IDS.has(v.templateId)) layout.templateId = v.templateId

  return Object.keys(layout).length > 0 ? layout : null
}

export function importApilotConfig(json: unknown): ApilotConfig | null {
  if (!isRecord(json)) return null
  if (json.version !== 1) return null
  if (!isRecord(json.resources)) return null

  const resources: Record<string, ResourceLayout> = {}
  for (const [basePath, rawLayout] of Object.entries(json.resources)) {
    const layout = sanitizeLayout(rawLayout)
    if (layout) resources[basePath] = layout
  }

  if (Object.keys(resources).length === 0) return null
  return {
    ...(typeof json.$schema === "string" ? { $schema: json.$schema } : {}),
    version: 1,
    resources,
  }
}

export async function importLayouts(specId: string, config: ApilotConfig): Promise<void> {
  for (const [basePath, layout] of Object.entries(config.resources)) {
    await saveLayout(specId, basePath, layout)
  }
}
