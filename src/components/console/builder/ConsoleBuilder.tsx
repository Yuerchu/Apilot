import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { X, Undo2, Redo2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { saveLayout as persistLayout, deleteLayout, exportApilotConfig } from "@/lib/console/layout-config"
import { useAgGridEnterprise } from "@/components/endpoints/use-ag-grid-enterprise"
import { buildFieldMap, type FieldMeta } from "@/components/endpoints/ResponseTableView"
import { buildJsonSchemaTree } from "@/lib/json-schema-tree"
import { selectBestTemplate, getFormSchema } from "@/lib/console/templates"
import type { ConsoleResource, ColumnConfig, FormFieldConfig, DetailFieldConfig, ResourceLayout, EditableDimension } from "@/lib/console/types"
import type { SchemaObject } from "@/lib/openapi/types"
import { TEMPLATE_COMPONENTS } from "../templates"
import { ConsoleListPage } from "../ConsoleListPage"
import { ColumnSortableList } from "./ColumnSortableList"
import { ColumnPropertyEditor } from "./ColumnPropertyEditor"
import { FormFieldSortableList } from "./FormFieldSortableList"
import { FormFieldPropertyEditor } from "./FormFieldPropertyEditor"
import { DetailFieldPropertyEditor } from "./DetailFieldPropertyEditor"
import { StatsConfigEditor } from "./StatsConfigEditor"
import { SearchConfigEditor } from "./SearchConfigEditor"
import { GeneralTab } from "./GeneralTab"
import { ComponentLibrary } from "./ComponentLibrary"
import { toast } from "sonner"

type ActiveTab = "general" | "columns" | "create" | "update" | "form" | "detail" | "stats" | "search" | "components"

interface ConsoleBuilderProps {
  resource: ConsoleResource
  listData: unknown
}

function schemaToFieldConfigs(schema: SchemaObject | null): FormFieldConfig[] {
  if (!schema?.properties) return []
  return Object.keys(schema.properties).map((field, i) => ({
    field,
    visible: true,
    order: i,
  }))
}

function schemaToDetailConfigs(schema: SchemaObject | null): DetailFieldConfig[] {
  if (!schema?.properties) return []
  return Object.keys(schema.properties).map((field, i) => ({
    field,
    visible: true,
    order: i,
  }))
}

function getSchemaPropertyDescriptions(schema: SchemaObject | null): Record<string, { description?: string | undefined }> {
  if (!schema?.properties) return {}
  const result: Record<string, { description?: string | undefined }> = {}
  for (const [key, prop] of Object.entries(schema.properties)) {
    result[key] = { description: (prop as SchemaObject).description }
  }
  return result
}

export function ConsoleBuilder({ resource, listData }: ConsoleBuilderProps) {
  const { t } = useTranslation()
  const { activeLayout, state, dispatch, specId } = useConsoleContext()
  const enterprise = useAgGridEnterprise()

  // Action pages key their layouts by the synthetic basePath (= route path),
  // which may differ from what activeLayout (parent resource) resolves to.
  const savedLayout = state.layouts[resource.basePath] ?? activeLayout ?? null

  const [draft, setDraft] = useState<ResourceLayout>(() => ({ ...(savedLayout ?? {}) }))
  const [history, setHistory] = useState<ResourceLayout[]>([])
  const [redoStack, setRedoStack] = useState<ResourceLayout[]>([])
  const [selectedField, setSelectedField] = useState<string | null>(null)

  const template = selectBestTemplate(resource, draft.templateId)

  const updateDraft = useCallback((patch: Partial<ResourceLayout>) => {
    setHistory(h => [...h, draft])
    setRedoStack([])
    setDraft(d => ({ ...d, ...patch }))
  }, [draft])

  const handleUndo = useCallback(() => {
    const prev = history[history.length - 1]
    if (!prev) return
    setRedoStack(r => [...r, draft])
    setDraft(prev)
    setHistory(h => h.slice(0, -1))
  }, [history, draft])

  const handleRedo = useCallback(() => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    setHistory(h => [...h, draft])
    setDraft(next)
    setRedoStack(r => r.slice(0, -1))
  }, [redoStack, draft])

  // --- Seeds: what each dimension's field list looks like before any edits ---

  const fieldMap = useMemo(() => {
    if (!resource.listItemSchema) return new Map<string, FieldMeta>()
    try {
      const nodes = buildJsonSchemaTree(resource.listItemSchema, new Map())
      return buildFieldMap(nodes)
    } catch { return new Map<string, FieldMeta>() }
  }, [resource.listItemSchema])

  const seededColumns = useMemo((): ColumnConfig[] => {
    if (draft.columns) return draft.columns
    const fromData = extractItems(listData)
    const cols = fromData.length > 0
      ? collectKeys(fromData)
      : Object.keys(resource.listItemSchema?.properties ?? {})
    return cols.map((field, i) => ({ field, visible: true, order: i }))
  }, [draft.columns, listData, resource.listItemSchema])

  const formSchema = useMemo(() => getFormSchema(resource, template.id), [resource, template.id])
  const seededFormFields = useMemo(
    () => draft.formFields ?? schemaToFieldConfigs(formSchema),
    [draft.formFields, formSchema],
  )
  const seededCreateFields = useMemo(
    () => draft.createFields ?? schemaToFieldConfigs(resource.createSchema),
    [draft.createFields, resource.createSchema],
  )
  const seededUpdateFields = useMemo(
    () => draft.updateFields ?? schemaToFieldConfigs(resource.updateSchema),
    [draft.updateFields, resource.updateSchema],
  )
  const seededDetailFields = useMemo(
    () => draft.detailFields ?? schemaToDetailConfigs(resource.detailSchema ?? resource.listItemSchema),
    [draft.detailFields, resource.detailSchema, resource.listItemSchema],
  )

  const createSchemaProps = useMemo(() => getSchemaPropertyDescriptions(resource.createSchema), [resource.createSchema])
  const updateSchemaProps = useMemo(() => getSchemaPropertyDescriptions(resource.updateSchema), [resource.updateSchema])
  const formSchemaProps = useMemo(() => getSchemaPropertyDescriptions(formSchema), [formSchema])
  const detailSchemaProps = useMemo(
    () => getSchemaPropertyDescriptions(resource.detailSchema ?? resource.listItemSchema),
    [resource.detailSchema, resource.listItemSchema],
  )

  const statsCandidates = useMemo(() => {
    const schema = resource.detailSchema ?? resource.listItemSchema
    return Object.keys(schema?.properties ?? {})
  }, [resource.detailSchema, resource.listItemSchema])

  const searchCandidates = useMemo(
    () => Object.keys(resource.listItemSchema?.properties ?? resource.detailSchema?.properties ?? {}),
    [resource.listItemSchema, resource.detailSchema],
  )

  // --- Tabs derived from the template's capability matrix ---

  const tabs = useMemo((): ActiveTab[] => {
    const list: ActiveTab[] = ["general"]
    for (const dim of template.editable) {
      if (dim === "columns" && enterprise) continue
      list.push(dim as ActiveTab)
    }
    const hasFormDims = (["form", "create", "update"] as EditableDimension[]).some(d => template.editable.includes(d))
    if (hasFormDims) list.push("components")
    return list
  }, [template, enterprise])

  const [activeTab, setActiveTab] = useState<ActiveTab>("general")
  const effectiveTab: ActiveTab = tabs.includes(activeTab) ? activeTab : "general"

  // --- Selected item for the right panel ---

  const selectedColumn = effectiveTab === "columns" && selectedField
    ? seededColumns.find(c => c.field === selectedField) ?? null : null
  const selectedFormField = effectiveTab === "form" && selectedField
    ? seededFormFields.find(f => f.field === selectedField) ?? null : null
  const selectedCreateField = effectiveTab === "create" && selectedField
    ? seededCreateFields.find(f => f.field === selectedField) ?? null : null
  const selectedUpdateField = effectiveTab === "update" && selectedField
    ? seededUpdateFields.find(f => f.field === selectedField) ?? null : null
  const selectedDetailField = effectiveTab === "detail" && selectedField
    ? seededDetailFields.find(f => f.field === selectedField) ?? null : null

  // --- Save / export / reset / exit ---

  const handleSave = useCallback(() => {
    dispatch({ type: "SET_LAYOUT", basePath: resource.basePath, layout: draft })
    dispatch({ type: "SET_BUILDER_MODE", on: false })
    if (specId) {
      persistLayout(specId, resource.basePath, draft).catch(() => {
        toast.error("Failed to persist layout")
      })
    }
    toast.success(t("console.updated"))
  }, [draft, resource.basePath, dispatch, specId, t])

  const handleExit = useCallback(() => {
    dispatch({ type: "SET_BUILDER_MODE", on: false })
  }, [dispatch])

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET_LAYOUT", basePath: resource.basePath })
    dispatch({ type: "SET_BUILDER_MODE", on: false })
    if (specId) {
      deleteLayout(specId, resource.basePath).catch(() => {
        toast.error("Failed to delete layout")
      })
    }
    toast.success(t("console.updated"))
  }, [resource.basePath, dispatch, specId, t])

  const handleExport = useCallback(() => {
    const config = exportApilotConfig({ [resource.basePath]: draft })
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${resource.name}.apilot`
    a.click()
    URL.revokeObjectURL(url)
  }, [draft, resource.basePath, resource.name])

  // --- Preview component (current template, live draft) ---

  const PreviewComponent = TEMPLATE_COMPONENTS[template.id]

  const tabLabel = (tab: ActiveTab): string => {
    switch (tab) {
      case "general": return t("console.builder.general")
      case "columns": return t("console.builder.columns")
      case "create": return t("console.create")
      case "update": return t("console.edit")
      case "form": return t("console.builder.form")
      case "detail": return t("console.builder.detail")
      case "stats": return t("console.builder.stats")
      case "search": return t("console.builder.search")
      case "components": return t("console.builder.components")
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
        <span className="text-sm font-medium">{draft.displayNameOverride || resource.displayName}</span>
        <span className="text-xs text-muted-foreground">— {t(template.name)}</span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7" onClick={handleUndo} disabled={history.length === 0}>
          <Undo2 className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={handleRedo} disabled={redoStack.length === 0}>
          <Redo2 className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={handleExport}>
          <Download className="size-3.5 mr-1" />
          Export
        </Button>
        <Button size="sm" onClick={handleSave}>
          {t("console.save")}
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={handleExit}>
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: editable dimensions */}
        <aside className="w-72 shrink-0 border-r overflow-y-auto flex flex-col">
          <Tabs value={effectiveTab} onValueChange={v => { setActiveTab(v as ActiveTab); setSelectedField(null) }} className="h-full flex flex-col">
            <TabsList className="mx-2 mt-2 shrink-0 h-auto flex-wrap">
              {tabs.map(tab => (
                <TabsTrigger key={tab} value={tab} className="text-xs">{tabLabel(tab)}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="general" className="flex-1 min-h-0 mt-0">
              <GeneralTab resource={resource} draft={draft} onChange={updateDraft} onReset={handleReset} />
            </TabsContent>

            {tabs.includes("columns") && (
              <TabsContent value="columns" className="flex-1 min-h-0 mt-0">
                <ColumnSortableList
                  columns={seededColumns}
                  fieldMap={fieldMap}
                  selectedField={selectedField}
                  onColumnsChange={cols => updateDraft({ columns: cols })}
                  onSelectField={setSelectedField}
                />
              </TabsContent>
            )}

            {tabs.includes("form") && (
              <TabsContent value="form" className="flex-1 min-h-0 mt-0">
                <FormFieldSortableList
                  fields={seededFormFields}
                  schemaProperties={formSchemaProps}
                  selectedField={selectedField}
                  onFieldsChange={fields => updateDraft({ formFields: fields })}
                  onSelectField={setSelectedField}
                />
              </TabsContent>
            )}

            {tabs.includes("create") && (
              <TabsContent value="create" className="flex-1 min-h-0 mt-0">
                <FormFieldSortableList
                  fields={seededCreateFields}
                  schemaProperties={createSchemaProps}
                  selectedField={selectedField}
                  onFieldsChange={fields => updateDraft({ createFields: fields })}
                  onSelectField={setSelectedField}
                />
              </TabsContent>
            )}

            {tabs.includes("update") && (
              <TabsContent value="update" className="flex-1 min-h-0 mt-0">
                <FormFieldSortableList
                  fields={seededUpdateFields}
                  schemaProperties={updateSchemaProps}
                  selectedField={selectedField}
                  onFieldsChange={fields => updateDraft({ updateFields: fields })}
                  onSelectField={setSelectedField}
                />
              </TabsContent>
            )}

            {tabs.includes("detail") && (
              <TabsContent value="detail" className="flex-1 min-h-0 mt-0">
                <FormFieldSortableList
                  fields={seededDetailFields}
                  schemaProperties={detailSchemaProps}
                  selectedField={selectedField}
                  onFieldsChange={fields => updateDraft({ detailFields: fields.map(({ field, visible, order, label }) => ({ field, visible, order, ...(label ? { label } : {}) })) })}
                  onSelectField={setSelectedField}
                />
              </TabsContent>
            )}

            {tabs.includes("stats") && (
              <TabsContent value="stats" className="flex-1 min-h-0 mt-0">
                <StatsConfigEditor
                  config={draft.statsConfig}
                  candidateFields={statsCandidates}
                  onChange={cfg => updateDraft({ statsConfig: cfg })}
                />
              </TabsContent>
            )}

            {tabs.includes("search") && (
              <TabsContent value="search" className="flex-1 min-h-0 mt-0">
                <SearchConfigEditor
                  config={draft.searchConfig}
                  candidateFields={searchCandidates}
                  onChange={cfg => updateDraft({ searchConfig: cfg })}
                />
              </TabsContent>
            )}

            {tabs.includes("components") && (
              <TabsContent value="components" className="flex-1 min-h-0 mt-0">
                <ComponentLibrary />
              </TabsContent>
            )}
          </Tabs>
        </aside>

        {/* Center: live preview of the current template */}
        <main className="flex-1 min-w-0 overflow-auto p-4">
          {template.id === "crud-table" ? (
            <ConsoleListPage resource={resource} readOnly layoutOverride={draft} />
          ) : PreviewComponent ? (
            <PreviewComponent key={template.id} resource={resource} layoutOverride={draft} />
          ) : (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
              {t("console.builder.noEditable")}
            </div>
          )}
        </main>

        {/* Right: property editor */}
        <aside className="w-64 shrink-0 border-l overflow-y-auto">
          {selectedColumn && (
            <ColumnPropertyEditor
              column={selectedColumn}
              onChange={updated => updateDraft({ columns: seededColumns.map(c => c.field === updated.field ? updated : c) })}
            />
          )}
          {selectedFormField && (
            <FormFieldPropertyEditor
              field={selectedFormField}
              onChange={updated => updateDraft({ formFields: seededFormFields.map(f => f.field === updated.field ? updated : f) })}
            />
          )}
          {selectedCreateField && (
            <FormFieldPropertyEditor
              field={selectedCreateField}
              onChange={updated => updateDraft({ createFields: seededCreateFields.map(f => f.field === updated.field ? updated : f) })}
            />
          )}
          {selectedUpdateField && (
            <FormFieldPropertyEditor
              field={selectedUpdateField}
              onChange={updated => updateDraft({ updateFields: seededUpdateFields.map(f => f.field === updated.field ? updated : f) })}
            />
          )}
          {selectedDetailField && (
            <DetailFieldPropertyEditor
              field={selectedDetailField}
              onChange={updated => updateDraft({ detailFields: seededDetailFields.map(f => f.field === updated.field ? updated : f) })}
            />
          )}
          {!selectedColumn && !selectedFormField && !selectedCreateField && !selectedUpdateField && !selectedDetailField && (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground px-4 text-center">
              {t("console.builder.selectField")}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function extractItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(r => r && typeof r === "object") as Record<string, unknown>[]
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    for (const key of ["items", "data", "results", "records", "rows", "list", "content", "entries"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[]
    }
  }
  return []
}

function collectKeys(items: Record<string, unknown>[]): string[] {
  const keys = new Set<string>()
  for (const item of items.slice(0, 50)) {
    for (const k of Object.keys(item)) keys.add(k)
  }
  return [...keys]
}
