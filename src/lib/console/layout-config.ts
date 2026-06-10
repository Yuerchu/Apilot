import { getDB } from "@/lib/db"
import type { ResourceLayout } from "./types"

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

export function importApilotConfig(json: unknown): ApilotConfig | null {
  if (!json || typeof json !== "object") return null
  const obj = json as Record<string, unknown>
  if (obj.version !== 1) return null
  if (!obj.resources || typeof obj.resources !== "object" || Array.isArray(obj.resources)) return null
  return obj as unknown as ApilotConfig
}

export async function importLayouts(specId: string, config: ApilotConfig): Promise<void> {
  for (const [basePath, layout] of Object.entries(config.resources)) {
    await saveLayout(specId, basePath, layout)
  }
}
