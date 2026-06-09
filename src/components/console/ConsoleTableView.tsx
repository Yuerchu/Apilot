import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AgGridReact } from "ag-grid-react"
import type { ColDef, DefaultMenuItem, RowSelectionOptions } from "ag-grid-community"
import type { CustomCellRendererProps } from "ag-grid-react"
import { Search, Download, FileSpreadsheet, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAgGridTheme, ValueCellRenderer } from "@/components/endpoints/ResponseAgGrid"
import { useAgGridEnterprise } from "@/components/endpoints/use-ag-grid-enterprise"
import { collectColumns, buildFieldMap, type FieldMeta } from "@/components/endpoints/ResponseTableView"
import { buildJsonSchemaTree } from "@/lib/json-schema-tree"
import "@/components/endpoints/ag-grid-modules"
import type { SchemaObject } from "@/lib/openapi/types"
import { AG_GRID_LOCALE_CN } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_HK } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_TW } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_JP } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_KR } from "@ag-grid-community/locale"
import type { LocaleText } from "ag-grid-community"
import { toast } from "sonner"

const AG_GRID_LOCALES: Record<string, LocaleText> = {
  zh_CN: AG_GRID_LOCALE_CN,
  zh_HK: AG_GRID_LOCALE_HK,
  zh_TW: AG_GRID_LOCALE_TW,
  ja: AG_GRID_LOCALE_JP,
  ko: AG_GRID_LOCALE_KR,
}

const rowSelectionOptions: RowSelectionOptions = { mode: "multiRow" }
const autoSizeStrategy = { type: "fitCellContents" as const, skipHeader: false }

interface ConsoleTableViewProps {
  data: unknown
  schema?: SchemaObject | undefined
  hasEdit?: boolean
  hasDelete?: boolean
  onEdit?: (row: Record<string, unknown>) => void
  onDelete?: (row: Record<string, unknown>) => void
}

export function ConsoleTableView({ data, schema, hasEdit, hasDelete, onEdit, onDelete }: ConsoleTableViewProps) {
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

  if (items.length === 0) return null

  return (
    <ConsoleAgGrid
      items={items}
      fieldMap={fieldMap}
      hasEdit={hasEdit}
      hasDelete={hasDelete}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )
}

function ActionCellRenderer(props: CustomCellRendererProps & {
  hasEdit?: boolean
  hasDelete?: boolean
  onEdit?: (row: Record<string, unknown>) => void
  onDelete?: (row: Record<string, unknown>) => void
}) {
  const { t } = useTranslation()
  const row = props.data as Record<string, unknown> | undefined
  if (!row) return null
  return (
    <span className="inline-flex items-center gap-1 h-full">
      {props.hasEdit && (
        <button
          type="button"
          onClick={() => props.onEdit?.(row)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-blue-500 hover:text-blue-400 transition-colors"
        >
          <Pencil className="size-3" />
          {t("console.edit")}
        </button>
      )}
      {props.hasDelete && (
        <button
          type="button"
          onClick={() => props.onDelete?.(row)}
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
  hasEdit?: boolean | undefined
  hasDelete?: boolean | undefined
  onEdit?: ((row: Record<string, unknown>) => void) | undefined
  onDelete?: ((row: Record<string, unknown>) => void) | undefined
}

function ConsoleAgGrid({ items, fieldMap, hasEdit, hasDelete, onEdit, onDelete }: ConsoleAgGridProps) {
  const { t, i18n } = useTranslation()
  const theme = useAgGridTheme()
  const localeText = AG_GRID_LOCALES[i18n.language]
  const enterprise = useAgGridEnterprise()
  const gridRef = useRef<AgGridReact>(null)
  const [quickFilter, setQuickFilter] = useState("")

  const hasActions = hasEdit || hasDelete

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: enterprise ? "agSetColumnFilter" : true,
    minWidth: 80,
    autoHeaderHeight: true,
    cellDataType: false,
  }), [enterprise])

  const columnDefs = useMemo<ColDef[]>(() => {
    const cols = collectColumns(items)
    const dataCols: ColDef[] = cols.map(key => {
      const meta = fieldMap.get(key)
      const label = meta?.description || key
      return {
        field: key,
        headerName: label,
        headerTooltip: label !== key ? `${key}: ${label}` : key,
        cellRenderer: ValueCellRenderer,
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
        cellRendererParams: { hasEdit, hasDelete, onEdit, onDelete },
      })
    }

    return dataCols
  }, [items, fieldMap, hasActions, hasEdit, hasDelete, onEdit, onDelete, t])

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
