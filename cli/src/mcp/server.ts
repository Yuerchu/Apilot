import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SpecStore } from "../core/spec-store"
import { loadConfig } from "../core/config"
import { registerTools } from "./tools"

export async function startMcpServer(defaultSpec?: string): Promise<void> {
  const server = new McpServer({
    name: "apilot",
    version: "1.0.0",
  })

  const specStore = new SpecStore()
  const cfgResult = loadConfig()

  if (defaultSpec) {
    try {
      await specStore.load(defaultSpec)
    } catch (e) {
      process.stderr.write(`Warning: failed to preload spec "${defaultSpec}": ${(e as Error).message}\n`)
    }
  } else if (cfgResult?.config.defaultSpec) {
    try {
      await specStore.load(cfgResult.config.defaultSpec, cfgResult.configDir)
    } catch (e) {
      process.stderr.write(`Warning: failed to preload default spec: ${(e as Error).message}\n`)
    }
  }

  registerTools(server, specStore, cfgResult)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

const isDirectRun = process.argv[1]?.endsWith("mcp.mjs") || process.argv[1]?.endsWith("mcp/server.ts")
if (isDirectRun) {
  startMcpServer().catch(e => {
    process.stderr.write(`Fatal: ${(e as Error).message}\n`)
    process.exit(1)
  })
}
