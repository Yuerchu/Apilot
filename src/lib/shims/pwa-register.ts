export function registerSW(_options?: { onNeedRefresh?: () => void }) {
  return (_reloadPage?: boolean) => Promise.resolve()
}
