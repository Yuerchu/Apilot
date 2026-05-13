#!/usr/bin/env node
import { parseArgs } from "node:util"
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, statSync, rmSync } from "node:fs"
import { resolve, dirname, join, extname, basename } from "node:path"
import { fileURLToPath } from "node:url"
import YAML from "yaml"

const __dirname = dirname(fileURLToPath(import.meta.url))
const VERSION = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")).version

const HELP = `
apilot build — Generate static API documentation from an OpenAPI/AsyncAPI spec

Usage:
  apilot build --spec <path> [options]

Options:
  --spec, -s <path>     Path to OpenAPI/AsyncAPI spec file (JSON or YAML)
  --out, -o <dir>       Output directory (default: ./apilot-dist)
  --title, -t <string>  Custom page title
  --single-file         Output a single self-contained HTML file
  --lang <code>         Default language (en, zh_CN, zh_HK, zh_TW, ja, ko)
  --help, -h            Show this help
  --version, -v         Show version
`.trim()

function fatal(msg: string): never {
  console.error(`\x1b[31merror:\x1b[0m ${msg}`)
  process.exit(1)
}

function dirSize(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) total += dirSize(p)
    else total += statSync(p).size
  }
  return total
}

function fileCount(dir: string): number {
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += fileCount(join(dir, entry.name))
    else count++
  }
  return count
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function escapeForScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script")
}

function inlineAssets(html: string, assetsDir: string): string {
  // Inline CSS: <link rel="stylesheet" ... href="./assets/xxx.css"> → <style>...</style>
  html = html.replace(
    /<link\s+rel="stylesheet"\s+crossorigin\s+href="\.\/assets\/([^"]+)">/g,
    (_match, file) => {
      const css = readFileSync(join(assetsDir, file), "utf8")
      return `<style>${css}</style>`
    },
  )

  // Remove modulepreload links (not needed when inlined)
  html = html.replace(/<link\s+rel="modulepreload"[^>]*>\n?/g, "")

  // Inline JS: <script type="module" crossorigin src="./assets/xxx.js"> → <script type="module">...</script>
  html = html.replace(
    /<script\s+type="module"\s+crossorigin\s+src="\.\/assets\/([^"]+)"><\/script>/g,
    (_match, file) => {
      const js = readFileSync(join(assetsDir, file), "utf8")
      return `<script type="module">${escapeForScript(js)}</script>`
    },
  )

  // Inline the favicon as data URI
  html = html.replace(
    /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\.\/favicon\.svg"\s*\/?>/,
    (_match) => {
      const svgPath = join(assetsDir, "..", "favicon.svg")
      if (existsSync(svgPath)) {
        const svg = readFileSync(svgPath, "utf8")
        const encoded = Buffer.from(svg).toString("base64")
        return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${encoded}">`
      }
      return _match
    },
  )

  return html
}

const { values } = parseArgs({
  options: {
    spec: { type: "string", short: "s" },
    out: { type: "string", short: "o", default: "./apilot-dist" },
    title: { type: "string", short: "t" },
    "single-file": { type: "boolean", default: false },
    lang: { type: "string" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  },
  allowPositionals: true,
  strict: false,
})

if (values.version) {
  console.log(VERSION)
  process.exit(0)
}

if (values.help) {
  console.log(HELP)
  process.exit(0)
}

if (!values.spec) {
  fatal("--spec is required. Run 'npx @yuerchu/apilot build --help' for usage.")
}

const specPath = resolve(values.spec as string)
if (!existsSync(specPath)) {
  fatal(`Spec file not found: ${specPath}`)
}

const rawSpec = readFileSync(specPath, "utf8")
let spec: Record<string, unknown>
const ext = extname(specPath).toLowerCase()

try {
  if (ext === ".json") {
    spec = JSON.parse(rawSpec)
  } else if (ext === ".yaml" || ext === ".yml") {
    spec = YAML.parse(rawSpec)
  } else {
    const trimmed = rawSpec.trim()
    spec = trimmed.startsWith("{") ? JSON.parse(trimmed) : YAML.parse(trimmed)
  }
} catch (e) {
  fatal(`Failed to parse spec file: ${(e as Error).message}`)
}

if (!spec!.openapi && !spec!.swagger && !spec!.asyncapi) {
  fatal("Spec file does not contain an 'openapi', 'swagger', or 'asyncapi' field.")
}

const singleFile = values["single-file"] as boolean
const outDir = resolve(values.out as string)
const templateDir = join(__dirname, "template", singleFile ? "single" : "multi")

if (!existsSync(templateDir)) {
  fatal(`Template not found at ${templateDir}. The package may be incomplete.`)
}

mkdirSync(outDir, { recursive: true })
cpSync(templateDir, outDir, { recursive: true })

const htmlPath = join(outDir, "index.html")
let html = readFileSync(htmlPath, "utf8")

const injections: string[] = []

if (singleFile) {
  // Inline all JS/CSS assets into the HTML
  const assetsDir = join(outDir, "assets")
  html = inlineAssets(html, assetsDir)

  // Embed the spec as JSON
  const specJson = JSON.stringify(spec!).replace(/<\//g, "<\\/")
  injections.push(`<script id="apilot-spec" type="application/json">${specJson}</script>`)
  injections.push(`<script>window.__EMBEDDED_SPEC__=JSON.parse(document.getElementById("apilot-spec").textContent)</script>`)

  const specSize = Buffer.byteLength(specJson, "utf8")
  if (specSize > 5 * 1024 * 1024) {
    console.warn(`\x1b[33mwarning:\x1b[0m Spec is ${formatSize(specSize)}. Consider using multi-file mode (without --single-file) for better performance.`)
  }
} else {
  const specOutPath = join(outDir, "spec.json")
  writeFileSync(specOutPath, JSON.stringify(spec!, null, 2), "utf8")
  injections.push(`<script>window.__OPENAPI_URL__="./spec.json"</script>`)
}

if (values.title) {
  const titleMatch = html.match(/<title>[^<]*<\/title>/)
  if (titleMatch && titleMatch.index !== undefined) {
    html = html.slice(0, titleMatch.index) + `<title>${values.title}</title>` + html.slice(titleMatch.index + titleMatch[0].length)
  }
  injections.push(`<script>window.__OPENAPI_TITLE__=${JSON.stringify(values.title)}</script>`)
}

if (values.lang) {
  const validLangs = ["en", "zh_CN", "zh_HK", "zh_TW", "ja", "ko"]
  if (!validLangs.includes(values.lang as string)) {
    console.warn(`\x1b[33mwarning:\x1b[0m Unknown language '${values.lang}'. Valid options: ${validLangs.join(", ")}`)
  }
  injections.push(`<script>localStorage.setItem("oa_locale",${JSON.stringify(values.lang)})</script>`)
}

if (injections.length > 0) {
  const marker = "</head>"
  const pos = html.lastIndexOf(marker)
  if (pos !== -1) {
    html = html.slice(0, pos) + injections.join("\n") + "\n" + html.slice(pos)
  }
}

writeFileSync(htmlPath, html, "utf8")

if (singleFile) {
  // Clean up inlined assets, keep only index.html
  const assetsDir = join(outDir, "assets")
  if (existsSync(assetsDir)) rmSync(assetsDir, { recursive: true })
  const faviconPath = join(outDir, "favicon.svg")
  if (existsSync(faviconPath)) rmSync(faviconPath)
}

const totalSize = singleFile
  ? statSync(htmlPath).size
  : dirSize(outDir)
const files = singleFile ? 1 : fileCount(outDir)

console.log(`\x1b[32m✓\x1b[0m Built to ${outDir}`)
console.log(`  ${files} file${files > 1 ? "s" : ""}, ${formatSize(totalSize)}`)
if (!singleFile) {
  console.log(`  Serve with: npx serve ${outDir}`)
}
