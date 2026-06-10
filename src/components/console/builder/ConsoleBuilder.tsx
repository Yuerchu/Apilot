import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { X, Undo2, Redo2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { saveLayout as persistLayout } from "@/lib/console/layout-config"
import { collectColumns, buildFieldMap, type FieldMeta } from "@/components/endpoints/ResponseTableView"
import { buildJsonSchemaTree } from "@/lib/json-schema-tree"
import type { ConsoleResource, ColumnConfig, FormFieldConfig, ResourceLayout } from "@/lib/console/types"
import type { SchemaObject } from "@/lib/openapi/types"
import { ColumnSortableList } from "./ColumnSortableList"
import { ColumnPropertyEditor } from "./ColumnPropertyEditor"
import { FormFieldSortableList } from "./FormFieldSortableList"
import { FormFieldPropertyEditor } from "./FormFieldPropertyEditor"
import { ComponentLibrary } from "./ComponentLibrary"
import { ConsoleListPage } from "../ConsoleListPage"
import { toast } from "sonner"

type ActiveTab = "columns" | "create" | "update" | "components"

interface ConsoleBuilderProps {
  resource: ConsoleResource
  listData: unknown
}

function schemaToFieldConfigs(schema: SchemaObject | null, existing?: FormFieldConfig[]): FormFieldConfig[] {
  if (!schema?.properties) return []
  if (existing && existing.length > 0) return existing
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
  const { activeLayout, dispatch, specId } = useConsoleContext()

  const fieldMap = useMemo(() => {
    if (!resource.listItemSchema) return new Map<string, FieldMeta>()
    try {
      const nodes = buildJsonSchemaTree(resource.listItemSchema, new Map())
      return buildFieldMap(nodes)
    } catch { return new Map<string, FieldMeta>() }
  }, [resource.listItemSchema])

  // Column configs
  const initialColumns = useMemo((): ColumnConfig[] => {
    if (activeLayout?.columns) return activeLayout.columns
    const items = extractItems(listData)
    const cols = items.length > 0 ? collectColumns(items) : Object.keys(resource.listItemSchema?.properties ?? {})
    return cols.map((field, i) => ({ field, visible: true, order: i }))
  }, [activeLayout, listData, resource.listItemSchema])

  // Form field configs
  const initialCreateFields = useMemo(
    () => schemaToFieldConfigs(resource.createSchema, activeLayout?.createFields),
    [resource.createSchema, activeLayout],
  )
  const initialUpdateFields = useMemo(
    () => schemaToFieldConfigs(resource.updateSchema, activeLayout?.updateFields),
    [resource.updateSchema, activeLayout],
  )

  const createSchemaProps = useMemo(() => getSchemaPropertyDescriptions(resource.createSchema), [resource.createSchema])
  const updateSchemaProps = useMemo(() => getSchemaPropertyDescriptions(resource.updateSchema), [resource.updateSchema])

  const [activeTab, setActiveTab] = useState<ActiveTab>("columns")
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns)
  const [createFields, setCreateFields] = useState<FormFieldConfig[]>(initialCreateFields)
  const [updateFields, setUpdateFields] = useState<FormFieldConfig[]>(initialUpdateFields)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ columns: ColumnConfig[]; createFields: FormFieldConfig[]; updateFields: FormFieldConfig[] }>>([])
  const [redoStack, setRedoStack] = useState<typeof history>([])

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev, { columns, createFields, updateFields }])
    setRedoStack([])
  }, [columns, createFields, updateFields])

  const handleColumnsChange = useCallback((next: ColumnConfig[]) => {
    pushHistory()
    setColumns(next)
  }, [pushHistory])

  const handleCreateFieldsChange = useCallback((next: FormFieldConfig[]) => {
    pushHistory()
    setCreateFields(next)
  }, [pushHistory])

  const handleUpdateFieldsChange = useCallback((next: FormFieldConfig[]) => {
    pushHistory()
    setUpdateFields(next)
  }, [pushHistory])

  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]!
    setRedoStack(r => [...r, { columns, createFields, updateFields }])
    setColumns(prev.columns)
    setCreateFields(prev.createFields)
    setUpdateFields(prev.updateFields)
    setHistory(h => h.slice(0, -1))
  }, [history, columns, createFields, updateFields])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]!
    setHistory(h => [...h, { columns, createFields, updateFields }])
    setColumns(next.columns)
    setCreateFields(next.createFields)
    setUpdateFields(next.updateFields)
    setRedoStack(r => r.slice(0, -1))
  }, [redoStack, columns, createFields, updateFields])

  // Selected item for right panel
  const selectedColumn = useMemo(
    () => activeTab === "columns" && selectedField ? columns.find(c => c.field === selectedField) ?? null : null,
    [activeTab, selectedField, columns],
  )
  const selectedCreateField = useMemo(
    () => activeTab === "create" && selectedField ? createFields.find(f => f.field === selectedField) ?? null : null,
    [activeTab, selectedField, createFields],
  )
  const selectedUpdateField = useMemo(
    () => activeTab === "update" && selectedField ? updateFields.find(f => f.field === selectedField) ?? null : null,
    [activeTab, selectedField, updateFields],
  )

  const handleColumnPropertyChange = useCallback((updated: ColumnConfig) => {
    pushHistory()
    setColumns(prev => prev.map(c => c.field === updated.field ? updated : c))
  }, [pushHistory])

  const handleCreateFieldPropertyChange = useCallback((updated: FormFieldConfig) => {
    pushHistory()
    setCreateFields(prev => prev.map(f => f.field === updated.field ? updated : f))
  }, [pushHistory])

  const handleUpdateFieldPropertyChange = useCallback((updated: FormFieldConfig) => {
    pushHistory()
    setUpdateFields(prev => prev.map(f => f.field === updated.field ? updated : f))
  }, [pushHistory])

  const handleSave = useCallback(() => {
    const layout: ResourceLayout = {
      ...activeLayout,
      columns,
      createFields: createFields.length > 0 ? createFields : undefined,
      updateFields: updateFields.length > 0 ? updateFields : undefined,
    }
    dispatch({ type: "SET_LAYOUT", basePath: resource.basePath, layout })
    dispatch({ type: "SET_BUILDER_MODE", on: false })
    if (specId) persistLayout(specId, resource.basePath, layout)
    toast.success(t("console.updated"))
  }, [columns, createFields, updateFields, activeLayout, resource.basePath, dispatch, specId, t])

  const handleExit = useCallback(() => {
    dispatch({ type: "SET_BUILDER_MODE", on: false })
  }, [dispatch])

  const handleExport = useCallback(() => {
    const layout: ResourceLayout = { columns, createFields, updateFields }
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${resource.name}.apilot.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [columns, createFields, updateFields, resource.name])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
        <span className="text-sm font-medium">{resource.displayName}</span>
        <span className="text-xs text-muted-foreground">— {t("console.edit")}</span>
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
        {/* Left: Field list */}
        <aside className="w-72 shrink-0 border-r overflow-y-auto flex flex-col">
          <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as ActiveTab); setSelectedField(null) }} className="h-full flex flex-col">
            <TabsList className="mx-2 mt-2 shrink-0 h-auto flex-wrap">
              <TabsTrigger value="columns" className="text-xs">Columns</TabsTrigger>
              {resource.createSchema && <TabsTrigger value="create" className="text-xs">{t("console.create")}</TabsTrigger>}
              {resource.updateSchema && <TabsTrigger value="update" className="text-xs">{t("console.edit")}</TabsTrigger>}
              <TabsTrigger value="components" className="text-xs">Components</TabsTrigger>
            </TabsList>
            <TabsContent value="columns" className="flex-1 min-h-0 mt-0">
              <ColumnSortableList
                columns={columns}
                fieldMap={fieldMap}
                selectedField={selectedField}
                onColumnsChange={handleColumnsChange}
                onSelectField={setSelectedField}
              />
            </TabsContent>
            <TabsContent value="create" className="flex-1 min-h-0 mt-0">
              <FormFieldSortableList
                fields={createFields}
                schemaProperties={createSchemaProps}
                selectedField={selectedField}
                onFieldsChange={handleCreateFieldsChange}
                onSelectField={setSelectedField}
              />
            </TabsContent>
            <TabsContent value="update" className="flex-1 min-h-0 mt-0">
              <FormFieldSortableList
                fields={updateFields}
                schemaProperties={updateSchemaProps}
                selectedField={selectedField}
                onFieldsChange={handleUpdateFieldsChange}
                onSelectField={setSelectedField}
              />
            </TabsContent>
            <TabsContent value="components" className="flex-1 min-h-0 mt-0">
              <ComponentLibrary />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center: Preview */}
        <main className="flex-1 min-w-0 overflow-auto p-4">
          <ConsoleListPage resource={resource} />
        </main>

        {/* Right: Property editor */}
        <aside className="w-64 shrink-0 border-l overflow-y-auto">
          {selectedColumn && (
            <ColumnPropertyEditor column={selectedColumn} onChange={handleColumnPropertyChange} />
          )}
          {selectedCreateField && (
            <FormFieldPropertyEditor field={selectedCreateField} onChange={handleCreateFieldPropertyChange} />
          )}
          {selectedUpdateField && (
            <FormFieldPropertyEditor field={selectedUpdateField} onChange={handleUpdateFieldPropertyChange} />
          )}
          {!selectedColumn && !selectedCreateField && !selectedUpdateField && (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
              {t("console.selectResource")}
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
