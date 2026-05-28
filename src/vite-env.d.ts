/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
declare const __GIT_HASH__: string
declare const __GIT_BRANCH__: string
declare const __BUILD_TIME__: string
declare const __CI__: boolean
declare const __CI_RUN_NUMBER__: string
declare const __AG_GRID_ENTERPRISE__: boolean
declare const __AG_GRID_LICENSE_KEY__: string

interface Window {
  __OPENAPI_URL__?: string
  __OPENAPI_TITLE__?: string
  __EMBEDDED_SPEC__?: Record<string, unknown>
}
