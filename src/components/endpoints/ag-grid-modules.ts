import {
  ModuleRegistry,
  ClientSideRowModelModule,
  QuickFilterModule,
  TextFilterModule,
  NumberFilterModule,
  CsvExportModule,
  RowSelectionModule,
  TooltipModule,
  LocaleModule,
  RowAutoHeightModule,
  ColumnAutoSizeModule,
  ValidationModule,
} from "ag-grid-community"

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  QuickFilterModule,
  TextFilterModule,
  NumberFilterModule,
  CsvExportModule,
  RowSelectionModule,
  TooltipModule,
  LocaleModule,
  RowAutoHeightModule,
  ColumnAutoSizeModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
])

let _loaded = false
let _promise: Promise<void> | null = null

export function isEnterprise(): boolean {
  return _loaded
}

export function loadEnterprise(): Promise<void> {
  if (!__AG_GRID_ENTERPRISE__) return Promise.resolve()
  if (_promise) return _promise
  _promise = (async () => {
    const {
      LicenseManager,
      SetFilterModule,
      ColumnsToolPanelModule,
      FiltersToolPanelModule,
      StatusBarModule,
      ContextMenuModule,
      ColumnMenuModule,
      ExcelExportModule,
      CellSelectionModule,
      ClipboardModule,
      RowGroupingModule,
      RowGroupingPanelModule,
    } = await import("ag-grid-enterprise")
    LicenseManager.setLicenseKey(__AG_GRID_LICENSE_KEY__)
    ModuleRegistry.registerModules([
      SetFilterModule,
      ColumnsToolPanelModule,
      FiltersToolPanelModule,
      StatusBarModule,
      ContextMenuModule,
      ColumnMenuModule,
      ExcelExportModule,
      CellSelectionModule,
      ClipboardModule,
      RowGroupingModule,
      RowGroupingPanelModule,
    ])
    _loaded = true
  })()
  return _promise
}
