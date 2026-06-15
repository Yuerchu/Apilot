/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching"
import { registerRoute } from "workbox-routing"
import { NetworkFirst } from "workbox-strategies"
import { ExpirationPlugin } from "workbox-expiration"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { isPrivateOrLocalHost } from "@/lib/openapi/url-guard"

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Only cache cross-origin *public* specs. Same-origin specs may be
// cookie/session-authenticated, and Authorization-bearing requests are
// excluded outright. Private/local network hosts are skipped so the fetch
// falls through to the page context, where Chrome can show the Private
// Network Access permission prompt.
registerRoute(
  ({ request, url, sameOrigin }) => {
    if (sameOrigin || request.headers.has("authorization")) return false
    if (isPrivateOrLocalHost(url.hostname)) return false
    return /(?:^|\/)(?:spec|openapi|swagger|asyncapi)[^/]*\.(json|ya?ml)$/i.test(url.pathname)
  },
  new NetworkFirst({
    cacheName: "api-specs",
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
)

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
