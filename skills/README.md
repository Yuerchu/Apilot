# Apilot AI Skills

This directory contains AI skill files that teach AI assistants (Claude Code, Cursor, Windsurf, etc.) how to use Apilot to view API documentation.

## Installation

Copy or symlink the skill files into your AI assistant's skill directory.

### Claude Code

```bash
# Option 1: Symlink (recommended — auto-updates with repo)
# On macOS/Linux:
ln -s /path/to/Apilot/skills/apilot-viewer.md ~/.claude/skills/apilot-viewer.md

# On Windows (run as admin or with developer mode):
mklink "%USERPROFILE%\.claude\skills\apilot-viewer.md" "C:\path\to\Apilot\skills\apilot-viewer.md"

# Option 2: Direct copy
cp /path/to/Apilot/skills/apilot-viewer.md ~/.claude/skills/
```

### Other AI assistants

Copy `apilot-viewer.md` into the assistant's system prompt, custom instructions, or skill/tool directory per its documentation.

## What it does

After installation, the AI assistant will know how to:

- Open any OpenAPI/AsyncAPI spec URL in Apilot (https://openapi.yxqi.cn)
- Construct deep links to specific endpoints, data models, or WebSocket channels
- Pre-fill authentication and base URL parameters
