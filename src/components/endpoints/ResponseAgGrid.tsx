import { useCallback, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { AgGridReact } from "ag-grid-react"
import {
  type ColDef,
  type DefaultMenuItem,
  type LocaleText,
  type RowSelectionOptions,
} from "ag-grid-community"
import type { CustomCellRendererProps } from "ag-grid-react"
import { AG_GRID_LOCALE_CN } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_HK } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_TW } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_JP } from "@ag-grid-community/locale"
import { AG_GRID_LOCALE_KR } from "@ag-grid-community/locale"
import { ChevronRight, ChevronDown, Search, Download, FileSpreadsheet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { agGridDarkTheme, agGridLightTheme } from "./ag-grid-theme"
import { useAgGridEnterprise } from "./use-ag-grid-enterprise"
import "./ag-grid-modules"
import type { FieldMeta } from "./ResponseTableView"
import { collectColumns } from "./ResponseTableView"
import { toast } from "sonner"

const AG_GRID_LOCALES: Record<string, LocaleText> = {
  zh_CN: AG_GRID_LOCALE_CN,
  zh_HK: AG_GRID_LOCALE_HK,
  zh_TW: AG_GRID_LOCALE_TW,
  ja: AG_GRID_LOCALE_JP,
  ko: AG_GRID_LOCALE_KR,
}

function useAgGridLocale(): LocaleText | undefined {
  const { i18n } = useTranslation()
  return AG_GRID_LOCALES[i18n.language]
}

export function useAgGridTheme() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"
  return useMemo(() => isDark ? agGridDarkTheme : agGridLightTheme, [isDark])
}

function formatScalar(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

export function ValueCellRenderer(props: CustomCellRendererProps) {
  const [open, setOpen] = useState(false)
  const { value, api } = props

  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">{String(value)}</span>
  }

  if (typeof value !== "object") {
    return <span>{formatScalar(value)}</span>
  }

  const json = JSON.stringify(value, null, 2)
  const oneLine = JSON.stringify(value)

  if (oneLine.length <= 80) {
    return <span className="text-muted-foreground">{oneLine}</span>
  }

  const toggle = () => {
    setOpen(prev => !prev)
    setTimeout(() => api.resetRowHeights(), 0)
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        <span className="truncate max-w-[250px]">{oneLine}</span>
      </button>
      {open && (
        <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap break-all leading-[1.3]">
          {json}
        </pre>
      )}
    </div>
  )
}

const autoSizeStrategy = {
  type: "fitCellContents" as const,
  skipHeader: false,
}

const rowSelectionOptions: RowSelectionOptions = { mode: "multiRow" }

interface ResponseAgGridProps {
  items: Record<string, unknown>[]
  fieldMap: Map<string, FieldMeta>
  maxHeight?: number | undefined
}

export function ResponseAgGrid({ items, fieldMap, maxHeight = 400 }: ResponseAgGridProps) {
  const { t } = useTranslation()
  const theme = useAgGridTheme()
  const localeText = useAgGridLocale()
  const enterprise = useAgGridEnterprise()
  const gridRef = useRef<AgGridReact>(null)
  const [quickFilter, setQuickFilter] = useState("")

  const useAutoHeight = items.length <= 20

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: enterprise ? "agSetColumnFilter" : true,
    minWidth: 80,
    autoHeight: useAutoHeight,
    autoHeaderHeight: true,
    cellDataType: false,
  }), [enterprise, useAutoHeight])

  const columnDefs = useMemo<ColDef[]>(() => {
    const cols = collectColumns(items)
    return cols.map(key => {
      const meta = fieldMap.get(key)
      return {
        field: key,
        headerName: key,
        ...(meta?.description ? { headerTooltip: meta.description } : {}),
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
    <div className="w-full border-l-2 border-muted-foreground/20 ml-3">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/20 border-b">
        <div className="relative flex-1 max-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input
            value={quickFilter}
            onChange={e => setQuickFilter(e.target.value)}
            placeholder={t("response.quickFilter")}
            className="h-6 pl-7 text-xs"
          />
        </div>
        <Button variant="ghost" size="xs" onClick={exportCsv} title={t("response.exportCsv")}>
          <Download className="size-3" />
          CSV
        </Button>
        {enterprise && (
          <Button variant="ghost" size="xs" onClick={exportExcel} title={t("response.exportExcel")}>
            <FileSpreadsheet className="size-3" />
            XLSX
          </Button>
        )}
      </div>
      <div style={useAutoHeight ? undefined : { height: maxHeight }}>
        <AgGridReact
          key={enterprise ? "e" : "c"}
          ref={gridRef}
          theme={theme}
          rowData={items}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          autoSizeStrategy={autoSizeStrategy}
          domLayout={useAutoHeight ? "autoHeight" : "normal"}
          overlayNoRowsTemplate={t("response.tableNoRows")}
          quickFilterText={quickFilter}
          rowSelection={rowSelectionOptions}
          suppressColumnVirtualisation
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

interface KeyValueRow {
  _field: string
  _description: string
  _type: string
  _value: unknown
  _isArray: boolean
  _arrayItems?: Record<string, unknown>[] | undefined
  _arrayFieldMap?: Map<string, FieldMeta> | undefined
  _isObject: boolean
  _objectData?: Record<string, unknown> | undefined
  _objectFieldMap?: Map<string, FieldMeta> | undefined
}

function FieldCellRenderer(props: CustomCellRendererProps<KeyValueRow>) {
  const row = props.data
  if (!row) return null
  return (
    <div className="min-w-0 py-0.5">
      <div className="font-mono text-xs font-medium">{row._field}</div>
      {row._description && (
        <div className="text-[10px] text-muted-foreground/60 mt-0.5 leading-tight whitespace-normal">
          {row._description}
        </div>
      )}
      {row._type && (
        <Badge variant="outline" className="mt-0.5 font-mono text-[9px] h-3.5 px-1 font-normal">
          {row._type}
        </Badge>
      )}
    </div>
  )
}

function KvValueCellRenderer(props: CustomCellRendererProps<KeyValueRow>) {
  const row = props.data
  if (!row) return null

  if (row._isArray && row._arrayItems) {
    return <span className="text-muted-foreground">{row._arrayItems.length} items</span>
  }

  if (row._isObject) {
    return null
  }

  const val = row._value
  if (typeof val === "string" && val.length > 80) {
    return <span className="truncate block max-w-full" title={val}>{val}</span>
  }

  return <ValueCellRenderer {...props} />
}

function isObjectArray(arr: unknown[]): arr is Record<string, unknown>[] {
  return arr.length > 0 && arr.every(item => item !== null && typeof item === "object" && !Array.isArray(item))
}

function inferType(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

const kvDefaultColDef: ColDef = {
  resizable: true,
  sortable: false,
  autoHeight: true,
  autoHeaderHeight: true,
  cellDataType: false,
}

export function ResponseKeyValueGrid({
  data,
  fieldMap,
  maxHeight = 400,
}: {
  data: Record<string, unknown>
  fieldMap: Map<string, FieldMeta>
  maxHeight?: number | undefined
}) {
  const { t } = useTranslation()
  const theme = useAgGridTheme()
  const localeText = useAgGridLocale()

  const { rowData, nestedGrids } = useMemo(() => {
    const rows: KeyValueRow[] = []
    const nested: Array<{ key: string; items: Record<string, unknown>[]; fieldMap: Map<string, FieldMeta> }> = []

    for (const key of Object.keys(data)) {
      const val = data[key]
      const meta = fieldMap.get(key)
      const isArr = Array.isArray(val) && isObjectArray(val)
      const isObj = !isArr && val !== null && typeof val === "object" && !Array.isArray(val)

      rows.push({
        _field: key,
        _description: meta?.description ?? "",
        _type: meta?.type || (val !== undefined ? inferType(val) : ""),
        _value: isArr || isObj ? null : val,
        _isArray: isArr,
        _arrayItems: isArr ? val as Record<string, unknown>[] : undefined,
        _arrayFieldMap: isArr ? (meta?.children ?? new Map()) : undefined,
        _isObject: isObj,
        _objectData: isObj ? val as Record<string, unknown> : undefined,
        _objectFieldMap: isObj ? (meta?.children ?? new Map()) : undefined,
      })

      if (isArr) {
        nested.push({ key, items: val as Record<string, unknown>[], fieldMap: meta?.children ?? new Map() })
      }
    }

    return { rowData: rows, nestedGrids: nested }
  }, [data, fieldMap])

  const columnDefs = useMemo<ColDef<KeyValueRow>[]>(() => [
    {
      headerName: t("response.tableField"),
      field: "_field",
      cellRenderer: FieldCellRenderer,
      minWidth: 200,
      maxWidth: 400,
      flex: 2,
    },
    {
      headerName: t("response.tableValue"),
      field: "_value",
      cellRenderer: KvValueCellRenderer,
      flex: 3,
    },
  ], [t])

  return (
    <div>
      <AgGridReact<KeyValueRow>
        theme={theme}
        {...(localeText ? { localeText } : {})}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={kvDefaultColDef}
        domLayout="autoHeight"
        overlayNoRowsTemplate={t("response.tableNoRows")}
        suppressCellFocus
        headerHeight={32}
      />
      {nestedGrids.map(({ key, items, fieldMap: fm }) => (
        <ResponseAgGrid key={key} items={items} fieldMap={fm} maxHeight={maxHeight} />
      ))}
    </div>
  )
}
