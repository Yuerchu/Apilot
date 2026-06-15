// Guards for untrusted URLs reachable from spec content / share links.
// apilot loads arbitrary third-party specs; their external $ref pointers and
// server URLs must be treated as untrusted to prevent SSRF / internal-network
// probing from the victim's browser. The library's own safeUrlResolver is a
// no-op in the browser, so we enforce these checks ourselves.

/**
 * True if the hostname points at a loopback, link-local, private, or otherwise
 * internal target that an untrusted spec must not be able to reach.
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  let h = hostname.toLowerCase().trim()
  // Strip IPv6 brackets that URL.hostname keeps (e.g. "[::1]").
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1)
  if (!h) return true

  // Hostname-based internal suffixes.
  if (h === "localhost" || h.endsWith(".localhost")) return true
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".home.arpa")) return true

  // IPv4 literal.
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 0 || a === 127 || a === 10) return true
    if (a === 169 && b === 254) return true // link-local
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
    return false
  }

  // IPv6 literal.
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true
    if (h.startsWith("fc") || h.startsWith("fd")) return true // unique-local fc00::/7
    if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true // link-local fe80::/10
    const mapped = h.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
    if (mapped) return isPrivateOrLocalHost(mapped[1]!)
    return false
  }

  // Bare single-label hostname (no dot) — likely an intranet name.
  if (!h.includes(".")) return true

  return false
}

/** True if the URL is a well-formed http(s) URL (rejects javascript:/file:/data: etc.). */
export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Whether an external $ref URL embedded in an untrusted spec may be fetched.
 * Allowed only when it is http(s), not pointing at an internal host, and its
 * origin is in the trusted set (the spec's own source origin + the app origin).
 */
export function isExternalRefAllowed(refUrl: string, allowedOrigins: readonly string[]): boolean {
  let u: URL
  try {
    u = new URL(refUrl)
  } catch {
    return false
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false
  if (isPrivateOrLocalHost(u.hostname)) return false
  return allowedOrigins.includes(u.origin)
}

/** Origin of a URL, or null if it cannot be parsed. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Whether sending credentials to `targetUrl` crosses out of the trusted origin
 * set (the spec's declared servers / the origin the user confirmed). Used to
 * warn before auth headers or OAuth2 passwords are sent to an attacker host.
 * A target that cannot be resolved to an absolute origin (e.g. a relative path)
 * is treated as same-origin (not cross-host).
 */
export function isCrossHostTarget(targetUrl: string, trustedOrigins: readonly string[]): boolean {
  const origin = originOf(targetUrl)
  if (!origin) return false
  if (trustedOrigins.length === 0) return false
  return !trustedOrigins.includes(origin)
}
