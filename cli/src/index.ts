#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const VERSION = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")).version

const HELP = `
apilot v${VERSION} — OpenAPI toolkit for humans and AI agents

Usage:
  apilot <command> [options]

Commands:
  build                 Generate static API documentation
  route list            List API endpoints from a spec
  route show            Show details of a specific endpoint
  schema show           Show a named schema definition
  request send          Send an HTTP request to an API endpoint
  env list              List configured environments
  env add               Add a new environment
  env remove            Remove an environment
  serve                 Start MCP server (stdio transport)

Options:
  --help, -h            Show this help
  --version, -v         Show version
`.trim()

const subcommand = process.argv[2]

switch (subcommand) {
  case "build": {
    const { runBuild } = await import("./build.js")
    runBuild(process.argv.slice(3), __dirname)
    break
  }
  case "route": {
    const { run } = await import("./commands/route.js")
    await run(process.argv.slice(3))
    break
  }
  case "schema": {
    const { run } = await import("./commands/schema.js")
    await run(process.argv.slice(3))
    break
  }
  case "request": {
    const { run } = await import("./commands/request.js")
    await run(process.argv.slice(3))
    break
  }
  case "env": {
    const { run } = await import("./commands/env.js")
    await run(process.argv.slice(3))
    break
  }
  case "serve": {
    const { run } = await import("./commands/serve.js")
    await run(process.argv.slice(3))
    break
  }
  case "--version":
  case "-v":
    console.log(VERSION)
    break
  case "--help":
  case "-h":
  case undefined:
    console.log(HELP)
    break
  default:
    console.error(`\x1b[31merror:\x1b[0m Unknown command: ${subcommand}`)
    console.log(HELP)
    process.exit(1)
}
