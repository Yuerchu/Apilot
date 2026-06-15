import { describe, expect, it } from "vitest"
import { isPrivateOrLocalHost, isHttpUrl, isExternalRefAllowed, isCrossHostTarget } from "@/lib/openapi/url-guard"

describe("url-guard", () => {
  describe("isPrivateOrLocalHost", () => {
    it("flags loopback / private / link-local IPv4", () => {
      for (const h of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.5.5", "172.31.0.1", "169.254.1.1", "0.0.0.0", "100.64.0.1"]) {
        expect(isPrivateOrLocalHost(h)).toBe(true)
      }
    })
    it("allows public IPv4", () => {
      for (const h of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.0.1", "93.184.216.34"]) {
        expect(isPrivateOrLocalHost(h)).toBe(false)
      }
    })
    it("flags loopback / ULA / link-local IPv6 (with or without brackets)", () => {
      for (const h of ["::1", "[::1]", "fc00::1", "fd12::3", "fe80::1", "[fe80::1]", "::ffff:127.0.0.1"]) {
        expect(isPrivateOrLocalHost(h)).toBe(true)
      }
    })
    it("flags IPv4-mapped IPv6 in hex form (browser normalization)", () => {
      // new URL("http://[::ffff:127.0.0.1]").hostname → "::ffff:7f00:1"
      expect(isPrivateOrLocalHost("::ffff:7f00:1")).toBe(true)       // 127.0.0.1
      expect(isPrivateOrLocalHost("::ffff:c0a8:1")).toBe(true)       // 192.168.0.1
      expect(isPrivateOrLocalHost("::ffff:a9fe:a9fe")).toBe(true)    // 169.254.169.254
      expect(isPrivateOrLocalHost("::ffff:808:808")).toBe(false)     // 8.8.8.8 — public
    })
    it("flags internal hostnames and bare single-label names", () => {
      for (const h of ["localhost", "foo.localhost", "service.local", "db.internal", "intranet"]) {
        expect(isPrivateOrLocalHost(h)).toBe(true)
      }
    })
    it("flags multicast addresses (IPv4 + IPv6)", () => {
      expect(isPrivateOrLocalHost("224.0.0.1")).toBe(true)
      expect(isPrivateOrLocalHost("239.255.255.250")).toBe(true)
      expect(isPrivateOrLocalHost("ff02::1")).toBe(true)
    })
    it("allows normal public hostnames", () => {
      for (const h of ["example.com", "api.example.com", "petstore.swagger.io"]) {
        expect(isPrivateOrLocalHost(h)).toBe(false)
      }
    })
  })

  describe("isHttpUrl", () => {
    it("accepts http(s)", () => {
      expect(isHttpUrl("https://example.com/openapi.json")).toBe(true)
      expect(isHttpUrl("http://example.com")).toBe(true)
    })
    it("rejects dangerous and malformed schemes", () => {
      for (const u of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "ftp://x", "not a url"]) {
        expect(isHttpUrl(u)).toBe(false)
      }
    })
  })

  describe("isExternalRefAllowed", () => {
    const allowed = ["https://api.example.com"]
    it("allows same-origin public refs", () => {
      expect(isExternalRefAllowed("https://api.example.com/models.json", allowed)).toBe(true)
    })
    it("blocks cross-origin refs", () => {
      expect(isExternalRefAllowed("https://evil.example/x.json", allowed)).toBe(false)
    })
    it("blocks internal targets even if origin would match scheme", () => {
      expect(isExternalRefAllowed("http://127.0.0.1/x.json", ["http://127.0.0.1"])).toBe(false)
      expect(isExternalRefAllowed("http://169.254.169.254/latest/meta-data", allowed)).toBe(false)
    })
    it("blocks non-http schemes", () => {
      expect(isExternalRefAllowed("file:///etc/passwd", allowed)).toBe(false)
    })
  })

  describe("isCrossHostTarget", () => {
    const trusted = ["https://api.example.com"]
    it("treats relative/unparseable targets as same-origin", () => {
      expect(isCrossHostTarget("/oauth/token", trusted)).toBe(false)
    })
    it("flags a different host", () => {
      expect(isCrossHostTarget("https://evil.example/token", trusted)).toBe(true)
    })
    it("allows a trusted host", () => {
      expect(isCrossHostTarget("https://api.example.com/token", trusted)).toBe(false)
    })
    it("never flags when there is no trust set", () => {
      expect(isCrossHostTarget("https://anything.example", [])).toBe(false)
    })
  })
})
