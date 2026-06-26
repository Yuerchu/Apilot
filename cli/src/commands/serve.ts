import { parseArgs } from "node:util"

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      spec: { type: "string", short: "s" },
      help: { type: "boolean", short: "h" },
    },
    strict: false,
  })

  if (values.help) {
    console.log(`apilot serve — Start MCP server (stdio transport)

Usage:
  apilot serve [--spec <path>]

The MCP server exposes OpenAPI tools for AI agents.
Configure in Claude Code .mcp.json or similar.`)
    return
  }

  const { startMcpServer } = await import("../mcp/server.js")
  await startMcpServer(values.spec as string | undefined)
}
