import { AllCommunityModule, ModuleRegistry } from "ag-grid-community"

ModuleRegistry.registerModules([AllCommunityModule])

let _loaded = false
let _promise: Promise<void> | null = null

export function isEnterprise(): boolean {
  return _loaded
}

export function loadEnterprise(): Promise<void> {
  if (!__AG_GRID_ENTERPRISE__) return Promise.resolve()
  if (_promise) return _promise
  _promise = (async () => {
    const { AllEnterpriseModule, LicenseManager } = await import("ag-grid-enterprise")
    LicenseManager.setLicenseKey(__AG_GRID_LICENSE_KEY__)
    ModuleRegistry.registerModules([AllEnterpriseModule])
    _loaded = true
  })()
  return _promise
}
