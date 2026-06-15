import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import { visualizer } from "rollup-plugin-visualizer"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}

// Inject a Content-Security-Policy meta tag at build time only (dev keeps Vite's
// inline HMR preamble working). connect-src is left open because this is an API
// testing tool that must reach arbitrary hosts; the value is in object-src/base-uri/
// frame-ancestors and constraining where scripts/styles/images may load from.
function cspPlugin() {
  const csp = [
    "default-src 'self'",
    "connect-src * data: blob: ws: wss:",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // 'unsafe-eval' is required: ajv compiles user-supplied JSON Schemas at runtime
    // via new Function (dynamic specs can't be precompiled). 'self' still blocks
    // loading executable script from external origins.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // Clickjacking: neither frame-ancestors (CSP) nor X-Frame-Options can be
    // enforced via <meta> — both require HTTP response headers. Deployers must set
    // `Content-Security-Policy: frame-ancestors 'none'` (or `X-Frame-Options: DENY`)
    // in their server/CDN/Cloudflare Pages _headers config.
  ].join("; ")
  return {
    name: "apilot-csp",
    apply: "build" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        "</title>",
        `</title>\n  <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const agGridLicense = process.env.VITE_AG_GRID_LICENSE || env.VITE_AG_GRID_LICENSE || ""

  return {
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
      manifest: {
        name: "Apilot",
        short_name: "Apilot",
        description: "API documentation viewer and testing tool",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
    }),
    process.env.ANALYZE === "true" && visualizer({ open: false, filename: "dist/stats.html", gzipSize: true }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    __GIT_HASH__: JSON.stringify(git("rev-parse --short HEAD")),
    __GIT_BRANCH__: JSON.stringify(git("rev-parse --abbrev-ref HEAD")),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __CI__: JSON.stringify(process.env.CI === "true"),
    __CI_RUN_NUMBER__: JSON.stringify(process.env.GITHUB_RUN_NUMBER ?? ""),
    // AG Grid Enterprise validates its license client-side, so the key is
    // necessarily embedded in the bundle. Keep it in a build-time env var
    // (VITE_AG_GRID_LICENSE) rather than committed source; this is a known,
    // unavoidable property of AG Grid Enterprise, not a leak to fix.
    __AG_GRID_ENTERPRISE__: JSON.stringify(!!agGridLicense),
    __AG_GRID_LICENSE_KEY__: JSON.stringify(agGridLicense),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("ag-grid-enterprise")) return "ag-grid-enterprise"
          if (id.includes("ag-grid")) return "ag-grid"
          if (id.includes("@asyncapi") || id.includes("@stoplight") || id.includes("nimma")) return "asyncapi"
          if (id.includes("@codemirror") || id.includes("@lezer")) return "codemirror"
          if (id.includes("@xyflow") || id.includes("@dagrejs")) return "graph"
          if (id.includes("@faker-js")) return "faker"
          if (id.includes("ajv")) return "ajv"
          if (id.includes("@redocly") || id.includes("api-smart-diff")) return "openapi-tools"
          if (id.includes("httpsnippet")) return "httpsnippet"
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      colorette: fileURLToPath(new URL("./src/lib/shims/colorette.ts", import.meta.url)),
      path: "path-browserify",
    },
  },
}})
