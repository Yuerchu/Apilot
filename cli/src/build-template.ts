import { build, type InlineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
const srcDir = fileURLToPath(new URL("../../src", import.meta.url))
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))

const sharedConfig: InlineConfig = {
  configFile: false,
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcDir,
      colorette: `${srcDir}/lib/shims/colorette.ts`,
      "virtual:pwa-register": `${srcDir}/lib/shims/pwa-register.ts`,
      path: "path-browserify",
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(""),
    __GIT_BRANCH__: JSON.stringify(""),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __CI__: JSON.stringify(true),
    __CI_RUN_NUMBER__: JSON.stringify(""),
  },
  base: "./",
  logLevel: "info",
}

console.log("Building multi-file template...")
await build({
  ...sharedConfig,
  build: {
    outDir: "cli/template/multi",
    emptyOutDir: true,
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
})

console.log("\nBuilding single-file assets...")
await build({
  ...sharedConfig,
  build: {
    outDir: "cli/template/single",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})

console.log("\n✓ Templates built successfully")
