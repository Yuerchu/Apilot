import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AgGridReact } from "ag-grid-react"
import type { ColDef, DefaultMenuItem, RowSelectionOptions } from "ag-grid-community"
import type { CustomCellRendererProps } from "ag-grid-react"
import { Search, Download, FileSpreadsheet, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAgGridTheme, useAgGridLocale, ValueCellRenderer } from "@/components/endpoints/ResponseAgGrid"
import { useAgGridEnterprise } from "@/components/endpoints/use-ag-grid-enterprise"
import { collectColumns, buildFieldMap, type FieldMeta } from "@/components/endpoints/ResponseTableView"
import { buildJsonSchemaTree } from "@/lib/json-schema-tree"
import "@/components/endpoints/ag-grid-modules"
import type { SchemaObject } from "@/lib/openapi/types"
import type { ColumnConfig } from "@/lib/console/types"
import { toast } from "sonner"

const rowSelectionOptions: RowSelectionOptions = { mode: "multiRow" }
const autoSizeStrategy = { type: "fitCellContents" as const, skipHeader: false }

interface ConsoleTableViewProps {
  data: unknown
  schema?: SchemaObject | undefined
  columnLayout?: ColumnConfig[] | undefined
  hasEdit?: boolean
  hasDelete?: boolean
  onEdit?: (row: Record<string, unknown>) => void
  onDelete?: (row: Record<string, unknown>) => void
}

export function ConsoleTableView({ data, schema, columnLayout, hasEdit, hasDelete, onEdit, onDelete }: ConsoleTableViewProps) {
  const items = useMemo(() => {
    if (Array.isArray(data)) return data.filter(r => r && typeof r === "object") as Record<string, unknown>[]
    return []
  }, [data])

  const fieldMap = useMemo(() => {
    if (!schema) return new Map<string, FieldMeta>()
    try {
      const nodes = buildJsonSchemaTree(schema, new Map())
      return buildFieldMap(nodes)
    } catch {
      return new Map<string, FieldMeta>()
    }
  }, [schema])

  if (items.length === 0) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No data</div>
  }

  return (
    <ConsoleAgGrid
      items={items}
      fieldMap={fieldMap}
      columnLayout={columnLayout}
      hasEdit={hasEdit}
      hasDelete={hasDelete}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )
}

interface GridContext {
  hasEdit?: boolean | undefined
  hasDelete?: boolean | undefined
  onEdit?: ((row: Record<string, unknown>) => void) | undefined
  onDelete?: ((row: Record<string, unknown>) => void) | undefined
}

function ActionCellRenderer(props: CustomCellRendererProps) {
  const { t } = useTranslation()
  const row = props.data as Record<string, unknown> | undefined
  const ctx = props.context as GridContext | undefined
  if (!row || !ctx) return null
  return (
    <span className="inline-flex items-center gap-1 h-full">
      {ctx.hasEdit && (
        <button
          type="button"
          onClick={() => ctx.onEdit?.(row)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
        >
          <Pencil className="size-3" />
          {t("console.edit")}
        </button>
      )}
      {ctx.hasDelete && (
        <button
          type="button"
          onClick={() => ctx.onDelete?.(row)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-red-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="size-3" />
          {t("console.delete")}
        </button>
      )}
    </span>
  )
}

interface ConsoleAgGridProps {
  items: Record<string, unknown>[]
  fieldMap: Map<string, FieldMeta>
  columnLayout?: ColumnConfig[] | undefined
  hasEdit?: boolean | undefined
  hasDelete?: boolean | undefined
  onEdit?: ((row: Record<string, unknown>) => void) | undefined
  onDelete?: ((row: Record<string, unknown>) => void) | undefined
}

function ConsoleAgGrid({ items, fieldMap, columnLayout, hasEdit, hasDelete, onEdit, onDelete }: ConsoleAgGridProps) {
  const { t } = useTranslation()
  const theme = useAgGridTheme()
  const localeText = useAgGridLocale()
  const enterprise = useAgGridEnterprise()
  const gridRef = useRef<AgGridReact>(null)
  const [quickFilter, setQuickFilter] = useState("")

  const hasActions = hasEdit || hasDelete

  const gridContext = useMemo<GridContext>(() => ({
    hasEdit, hasDelete, onEdit, onDelete,
  }), [hasEdit, hasDelete, onEdit, onDelete])

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: enterprise ? "agSetColumnFilter" : true,
    minWidth: 80,
    autoHeaderHeight: true,
    cellDataType: false,
  }), [enterprise])

  const columnDefs = useMemo<ColDef[]>(() => {
    const allCols = collectColumns(items)

    let orderedCols: string[]
    if (columnLayout && columnLayout.length > 0) {
      const layoutMap = new Map(columnLayout.map(c => [c.field, c]))
      const fromLayout = columnLayout
        .filter(c => c.visible)
        .sort((a, b) => a.order - b.order)
        .map(c => c.field)
        .filter(f => allCols.includes(f))
      const newCols = allCols.filter(f => !layoutMap.has(f))
      orderedCols = [...fromLayout, ...newCols]
    } else {
      orderedCols = allCols
    }

    const layoutMap = columnLayout ? new Map(columnLayout.map(c => [c.field, c])) : null

    const dataCols: ColDef[] = orderedCols.map(key => {
      const meta = fieldMap.get(key)
      const layout = layoutMap?.get(key)
      const label = layout?.headerLabel || meta?.description || key
      return {
        field: key,
        headerName: label,
        headerTooltip: label !== key ? `${key}: ${label}` : key,
        cellRenderer: ValueCellRenderer,
        ...(layout?.width ? { width: layout.width } : {}),
        ...(layout?.pinned ? { pinned: layout.pinned } : {}),
      }
    })

    if (hasActions) {
      dataCols.push({
        headerName: t("console.actions", "Actions"),
        field: "__actions",
        sortable: false,
        filter: false,
        resizable: false,
        pinned: "right",
        width: (hasEdit ? 70 : 0) + (hasDelete ? 70 : 0) + 16,
        cellRenderer: ActionCellRenderer,
      })
    }

    return dataCols
  }, [items, fieldMap, columnLayout, hasActions, hasEdit, hasDelete, t])

  const exportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv()
    toast.success(t("response.csvExported"))
  }, [t])

  const exportExcel = useCallback(() => {
    gridRef.current?.api.exportDataAsExcel()
    toast.success(t("response.excelExported"))
  }, [t])

  const sideBar = useMemo(() => {
    if (!enterprise) return undefined
    return {
      toolPanels: [
        { id: "columns", labelDefault: "Columns", labelKey: "columns", iconKey: "columns", toolPanel: "agColumnsToolPanel" },
        { id: "filters", labelDefault: "Filters", labelKey: "filters", iconKey: "filter", toolPanel: "agFiltersToolPanel" },
      ],
    }
  }, [enterprise])

  const contextMenuItems = useCallback((): DefaultMenuItem[] =>
    ["copy", "copyWithHeaders", "separator", "csvExport", "excelExport"],
  [])

  const statusBar = useMemo(() => ({
    statusPanels: [
      { statusPanel: "agTotalAndFilteredRowCountComponent", align: "left" as const },
      { statusPanel: "agSelectedRowCountComponent", align: "left" as const },
    ],
  }), [])

  return (
    <div className="flex flex-col h-full border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={quickFilter}
            onChange={e => setQuickFilter(e.target.value)}
            placeholder={t("response.quickFilter")}
            className="h-7 pl-8 text-xs"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={exportCsv} className="h-7 text-xs">
          <Download className="size-3.5 mr-1" />
          CSV
        </Button>
        {enterprise && (
          <Button variant="ghost" size="sm" onClick={exportExcel} className="h-7 text-xs">
            <FileSpreadsheet className="size-3.5 mr-1" />
            XLSX
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <AgGridReact
          key={enterprise ? "e" : "c"}
          ref={gridRef}
          theme={theme}
          context={gridContext}
          rowData={items}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          autoSizeStrategy={autoSizeStrategy}
          domLayout="normal"
          overlayNoRowsTemplate={t("response.tableNoRows")}
          quickFilterText={quickFilter}
          rowSelection={rowSelectionOptions}
          suppressColumnVirtualisation={false}
          suppressCellFocus
          enableCellTextSelection
          ensureDomOrder
          enableBrowserTooltips
          {...(localeText ? { localeText } : {})}
          {...(enterprise ? {
            statusBar,
            sideBar: sideBar!,
            getContextMenuItems: contextMenuItems,
          } : {})}
        />
      </div>
    </div>
  )
}
