import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { viteSingleFile } from "vite-plugin-singlefile"
import path from "node:path"
import { execSync } from "node:child_process"

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    __GIT_HASH__: JSON.stringify(git("rev-parse --short HEAD")),
    __GIT_BRANCH__: JSON.stringify(git("rev-parse --abbrev-ref HEAD")),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __CI__: JSON.stringify(process.env.CI === "true"),
    __CI_RUN_NUMBER__: JSON.stringify(process.env.GITHUB_RUN_NUMBER ?? ""),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      path: "path-browserify",
    },
  },
})
