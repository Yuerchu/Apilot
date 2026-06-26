# Apilot AI Skills

This directory contains AI skill files that teach AI assistants (Claude Code, Cursor, Windsurf, etc.) how to use Apilot.

## Available skills

| File | Purpose |
|------|---------|
| `apilot-viewer.md` | Open and share API docs via the Apilot web viewer |
| `apilot-mcp.md` | Query OpenAPI specs and send requests via MCP tools |

## Installation

### Claude Code — MCP tools (recommended for AI agents)

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "apilot": {
      "command": "node",
      "args": ["/path/to/Apilot/cli/mcp.mjs"]
    }
  }
}
```

Or if installed globally via npm:

```json
{
  "mcpServers": {
    "apilot": {
      "command": "apilot-mcp"
    }
  }
}
```

Then copy the skill file for context:

```bash
# macOS/Linux:
ln -s /path/to/Apilot/skills/apilot-mcp.md ~/.claude/skills/apilot-mcp.md

# Windows:
mklink "%USERPROFILE%\.claude\skills\apilot-mcp.md" "C:\path\to\Apilot\skills\apilot-mcp.md"
```

### Claude Code — Viewer skill

```bash
# macOS/Linux:
ln -s /path/to/Apilot/skills/apilot-viewer.md ~/.claude/skills/apilot-viewer.md

# Windows:
mklink "%USERPROFILE%\.claude\skills\apilot-viewer.md" "C:\path\to\Apilot\skills\apilot-viewer.md"
```

### Other AI assistants

Copy the skill files into the assistant's system prompt, custom instructions, or skill/tool directory per its documentation.

## What they do

**apilot-viewer**: The AI assistant knows how to open any OpenAPI/AsyncAPI spec URL in the Apilot web viewer (https://openapi.yxqi.cn), construct deep links to specific endpoints, data models, or WebSocket channels, and pre-fill authentication parameters.

**apilot-mcp**: The AI assistant can query OpenAPI specs without loading the full document into context — list endpoints, inspect request/response schemas, send real HTTP requests to configured environments, and migrate data between environments. Requires the MCP server to be configured.
