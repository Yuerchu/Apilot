import type { UrlState } from "@/contexts/OpenAPIContext"
import type { EndpointDetailTab } from "@/lib/openapi/types"
import { buildHashState } from "@/hooks/use-url-state"

export type ShareTarget =
  | { type: "endpoint"; endpointKey: string; label: string }
  | { type: "model"; modelName: string; label: string }
  | { type: "current"; label?: string }

export interface ShareLinkOptions {
  includeOpenAPIUrl: boolean
  includeBaseUrl: boolean
  includeLocation: boolean
}

export interface BuildShareLinkInput {
  currentHref: string
  state: UrlState
  specUrl: string
  baseUrl: string
  target: ShareTarget
  options: ShareLinkOptions
}

function cloneUrlState(state: UrlState): UrlState {
  return {
    ...state,
    activeTags: new Set(state.activeTags),
  }
}

function getSharedEndpointTab(state: UrlState): EndpointDetailTab {
  return state.mainView === "endpoints" ? state.endpointDetailTab : "doc"
}

export function buildSharedUrlState(state: UrlState, target: ShareTarget): UrlState {
  const next = cloneUrlState(state)

  if (target.type === "endpoint") {
    return {
      ...next,
      mainView: "endpoints",
      activeEndpointKey: target.endpointKey,
      endpointDetailTab: getSharedEndpointTab(state),
    }
  }

  if (target.type === "model") {
    return {
      ...next,
      mainView: "models",
      activeModelName: target.modelName,
      modelViewMode: state.mainView === "models" ? state.modelViewMode : "list",
    }
  }

  return next
}

export function canShareOpenAPIUrl(specUrl: string): boolean {
  return specUrl.trim().length > 0
}

export function buildShareLink({
  baseUrl,
  currentHref,
  options,
  specUrl,
  state,
  target,
}: BuildShareLinkInput): string {
  const url = new URL(currentHref)
  const params = new URLSearchParams()
  const trimmedSpecUrl = specUrl.trim()
  const trimmedBaseUrl = baseUrl.trim()

  if (options.includeOpenAPIUrl && canShareOpenAPIUrl(trimmedSpecUrl)) {
    params.set("openapi_url", trimmedSpecUrl)
  }

  if (options.includeBaseUrl && trimmedBaseUrl) {
    params.set("base_url", trimmedBaseUrl)
  }

  url.search = params.toString()
  url.hash = ""
  const baseHref = url.toString()

  if (!options.includeLocation) {
    return baseHref
  }

  return `${baseHref}${buildHashState(buildSharedUrlState(state, target))}`
}
