import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { X, Undo2, Redo2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { collectColumns, buildFieldMap, type FieldMeta } from "@/components/endpoints/ResponseTableView"
import { buildJsonSchemaTree } from "@/lib/json-schema-tree"
import type { ConsoleResource, ColumnConfig, ResourceLayout } from "@/lib/console/types"
import { ColumnSortableList } from "./ColumnSortableList"
import { ColumnPropertyEditor } from "./ColumnPropertyEditor"
import { ConsoleListPage } from "../ConsoleListPage"
import { toast } from "sonner"

interface ConsoleBuilderProps {
  resource: ConsoleResource
  listData: unknown
}

export function ConsoleBuilder({ resource, listData }: ConsoleBuilderProps) {
  const { t } = useTranslation()
  const { activeLayout, dispatch } = useConsoleContext()

  const fieldMap = useMemo(() => {
    if (!resource.listItemSchema) return new Map<string, FieldMeta>()
    try {
      const nodes = buildJsonSchemaTree(resource.listItemSchema, new Map())
      return buildFieldMap(nodes)
    } catch { return new Map<string, FieldMeta>() }
  }, [resource.listItemSchema])

  const initialColumns = useMemo((): ColumnConfig[] => {
    if (activeLayout?.columns) return activeLayout.columns

    const items = extractItems(listData)
    const cols = items.length > 0 ? collectColumns(items) : Object.keys(resource.listItemSchema?.properties ?? {})
    return cols.map((field, i) => ({
      field,
      visible: true,
      order: i,
    }))
  }, [activeLayout, listData, resource.listItemSchema])

  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [history, setHistory] = useState<ColumnConfig[][]>([])
  const [redoStack, setRedoStack] = useState<ColumnConfig[][]>([])

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev, columns])
    setRedoStack([])
  }, [columns])

  const handleColumnsChange = useCallback((next: ColumnConfig[]) => {
    pushHistory()
    setColumns(next)
  }, [pushHistory])

  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]!
    setRedoStack(r => [...r, columns])
    setColumns(prev)
    setHistory(h => h.slice(0, -1))
  }, [history, columns])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]!
    setHistory(h => [...h, columns])
    setColumns(next)
    setRedoStack(r => r.slice(0, -1))
  }, [redoStack, columns])

  const selectedColumn = useMemo(
    () => selectedField ? columns.find(c => c.field === selectedField) ?? null : null,
    [selectedField, columns],
  )

  const handleColumnPropertyChange = useCallback((updated: ColumnConfig) => {
    pushHistory()
    setColumns(prev => prev.map(c => c.field === updated.field ? updated : c))
  }, [pushHistory])

  const handleSave = useCallback(() => {
    const layout: ResourceLayout = {
      ...activeLayout,
      columns,
    }
    dispatch({ type: "SET_LAYOUT", basePath: resource.basePath, layout })
    dispatch({ type: "SET_BUILDER_MODE", on: false })
    toast.success(t("console.updated"))
  }, [columns, activeLayout, resource.basePath, dispatch, t])

  const handleExit = useCallback(() => {
    dispatch({ type: "SET_BUILDER_MODE", on: false })
  }, [dispatch])

  const handleExport = useCallback(() => {
    const layout: ResourceLayout = { columns }
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${resource.name}.apilot.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [columns, resource.name])

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
          {t("console.save")}
        </Button>
        <Button size="sm" onClick={handleSave}>
          {t("console.save")}
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={handleExit}>
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Three-panel layout */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Left: Field list */}
        <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
          <Tabs defaultValue="columns" className="h-full flex flex-col">
            <TabsList className="mx-2 mt-2 shrink-0">
              <TabsTrigger value="columns" className="text-xs">{t("console.actions")}</TabsTrigger>
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
          </Tabs>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center: Preview */}
        <ResizablePanel defaultSize={56} minSize={30}>
          <ScrollArea className="h-full">
            <div className="p-4">
              <ConsoleListPage resource={resource} />
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Property editor */}
        <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
          <ScrollArea className="h-full">
            {selectedColumn ? (
              <ColumnPropertyEditor column={selectedColumn} onChange={handleColumnPropertyChange} />
            ) : (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                {t("console.selectResource")}
              </div>
            )}
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
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
