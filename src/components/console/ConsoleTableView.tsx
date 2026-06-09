import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AgGridReact } from "ag-grid-react"
import type { ColDef, DefaultMenuItem, RowSelectionOptions } from "ag-grid-community"
import { Search, Download, FileSpreadsheet } from "lucide-react"
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
}

export function ConsoleTableView({ data, schema }: ConsoleTableViewProps) {
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

  return <ConsoleAgGrid items={items} fieldMap={fieldMap} />
}

function ConsoleAgGrid({ items, fieldMap }: { items: Record<string, unknown>[]; fieldMap: Map<string, FieldMeta> }) {
  const { t, i18n } = useTranslation()
  const theme = useAgGridTheme()
  const localeText = AG_GRID_LOCALES[i18n.language]
  const enterprise = useAgGridEnterprise()
  const gridRef = useRef<AgGridReact>(null)
  const [quickFilter, setQuickFilter] = useState("")

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
    return cols.map(key => {
      const meta = fieldMap.get(key)
      const label = meta?.description || key
      return {
        field: key,
        headerName: label,
        headerTooltip: label !== key ? `${key}: ${label}` : key,
        cellRenderer: ValueCellRenderer,
      }
    })
  }, [items, fieldMap])

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
