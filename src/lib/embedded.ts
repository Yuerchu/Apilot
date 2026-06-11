export function isEmbeddedMode(): boolean {
  return !!(window.__EMBEDDED_SPEC__ || window.__OPENAPI_URL__)
}

export function isHideTryIt(): boolean {
  return !!window.__HIDE_TRY_IT__
}
