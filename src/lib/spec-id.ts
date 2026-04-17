import type { OpenAPISpec } from "@/lib/openapi/types"
import { resolveServerUrl } from "@/lib/openapi/parser"

function getOrigin(url: string): string {
  try {
    const u = new URL(url)
    return u.host
  } catch {
    return url
  }
}

export function computeSpecId(spec: OpenAPISpec, baseUrl: string, specUrl: string): string {
  const title = spec.info?.title || "untitled"
  const version = spec.info?.version || "0"

  let origin = "local"
  const servers = spec.servers
  if (servers?.length) {
    origin = getOrigin(resolveServerUrl(servers[0]!))
  } else if (spec.host) {
    origin = spec.host
  } else if (baseUrl) {
    origin = getOrigin(baseUrl)
  } else if (specUrl) {
    origin = getOrigin(specUrl)
  }

  return `${title}@${version}::${origin}`
}
