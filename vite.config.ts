import { defineConfig } from "vite"
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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg}"],
        runtimeCaching: [
          {
            // Cache API spec fetches (network-first, fallback to cache for offline)
            urlPattern: /\.(json|yaml|yml)$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-specs",
              expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
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
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
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
})
