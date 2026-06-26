# Apilot

**Apilot** is a modern **Swagger UI alternative** — an OpenAPI documentation viewer and API testing tool that handles 500+ endpoints without lag. Drop-in replacement for Swagger UI, Redoc, and Scalar with schema-driven forms, live request testing, model relationship graphs, and multi-environment management.

Built with React, TypeScript, Shadcn/ui, and Tailwind CSS.

**Live Demo**: [openapi.yxqi.cn](https://openapi.yxqi.cn) | [README 中文版](README.zh-CN.md)

## Why Apilot?

| | Swagger UI | Redoc | Scalar | **Apilot** |
|---|---|---|---|---|
| Live API testing | ✅ | ❌ | ✅ | ✅ |
| Schema-driven forms | ❌ | ❌ | Partial | ✅ |
| Model relationship graph | ❌ | ❌ | ❌ | ✅ |
| Multi-environment management | ❌ | ❌ | ❌ | ✅ |
| Cross-environment API status | ❌ | ❌ | ❌ | ✅ |
| Spec diff & diagnostics | ❌ | ❌ | ❌ | ✅ |
| Single HTML file output | ❌ | ❌ | ❌ | ✅ |
| i18n (6 languages) | ❌ | ❌ | ❌ | ✅ |
| CLI for static docs generation | ❌ | ✅ | ❌ | ✅ |
| MCP server for AI agents | ❌ | ❌ | ❌ | ✅ |
| FastAPI integration | Built-in | Community | Community | ✅ |

## Features

### API Documentation & Testing

- **Schema-driven forms** — Auto-renders inputs based on OpenAPI schema types (text, number, boolean, enum, date picker, file upload, UUID generator)
- **Live API testing** — Send requests directly from the browser with parameter validation, auth headers, and response display
- **JSON editor** — CodeMirror 6 with syntax highlighting, bidirectional sync with schema form
- **Structured schema display** — Three-column table view (Field / Type / Description) with nested object support
- **Curl generation** — Auto-generated curl command with one-click copy
- **Token extraction** — Detect token fields in login responses and apply as Bearer auth with one click
- **Request history** — Per-endpoint request history stored in IndexedDB

### Data Models

- **Model browser** — Browse all schema definitions with field details and constraints
- **Model graph** — Interactive relationship graph with focus/depth controls and SVG/PNG/Mermaid export
- **Model ↔ Endpoint linking** — See which models an endpoint uses, and which endpoints reference a model

### Schema Viewer

- **OpenAPI & external schemas** — View schemas from loaded spec or upload standalone JSON/YAML files
- **Field detail inspector** — Constraints, default values, enum options, file upload rules, cross-field rules
- **Category & type filtering** — Filter schemas by category tags and types

### Environment Management

- **Environment profiles** — Create multiple environments (local/dev/test/staging/prod) with independent base URLs and auth configs
- **Auto-seed from spec** — Environments auto-populate from OpenAPI `servers[]` field
- **Per-environment auth** — Each environment stores its own auth type, token, and credentials
- **Quick switching** — Sidebar dropdown switcher (shadcn workspace-switcher pattern) for instant environment switching
- **Cross-environment API status** — Background-fetch specs from all environments to detect endpoint presence; auto-infers lifecycle status (Online / Testing / In Dev / Local Only / Teammate's Work)
- **Status filtering** — Filter endpoints by their cross-environment status

### Diagnostics & Diff

- **API diagnostics** — Detect issues like unresolved $refs, duplicate operationIds, empty schemas, missing descriptions
- **Spec diff** — Compare two OpenAPI specs side-by-side with breaking change detection

### Favorites

- **Star endpoints** — Bookmark frequently used endpoints with a star icon
- **Favorites view** — Dedicated sidebar page to browse all starred endpoints

### General

- **Multiple auth methods** — Bearer, Basic, API Key, OAuth2 Password flow
- **Swagger 2.0 / OpenAPI 3.0 / 3.1 compatible** — Auto-converts Swagger 2.0 specs
- **Dark theme** — OKLCH color system with system/light/dark mode
- **i18n** — English, Simplified Chinese, Traditional Chinese, Hong Kong Chinese, Japanese, Korean
- **Share links** — Generate shareable URLs with spec, base URL, and current location
- **Environment variables** — Define `{{variables}}` for use in parameters and request bodies
- **Command palette** — `Cmd+K` / `Ctrl+K` to search endpoints, models, and schemas
- **Progressive rendering** — Handles 500+ endpoints without blocking the UI
- **Single-file output** — Builds to a single `dist/index.html` for easy deployment
- **FastAPI integration** — Python package for drop-in Swagger UI replacement

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173), paste an OpenAPI spec URL, and click Load.

## URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `openapi_url` | Auto-load spec from URL | `?openapi_url=https://api.example.com/openapi.json` |
| `base_url` | Override server base URL | `&base_url=https://api.example.com` |
| `auth_type` | Set auth type (`bearer`, `basic`, `apikey`) | `&auth_type=bearer` |
| `auth_token` | Set auth token | `&auth_token=xxx` |
| `title` | Override page title | `&title=My%20API` |

## Build

```bash
pnpm build        # Production build -> dist/index.html (single file)
pnpm test         # Run tests
pnpm lint         # ESLint
pnpm typecheck    # TypeScript type check
```

## CLI

Apilot includes a CLI for static docs generation, API querying, and an MCP server for AI agents.

### Static Docs Generation

```bash
npx @yuerchu/apilot build --spec openapi.json --out ./docs
npx @yuerchu/apilot build --spec openapi.yaml --out ./docs --title "My API" --single-file
```

| Option | Description |
|--------|-------------|
| `--spec, -s` | Path to OpenAPI/AsyncAPI spec file (JSON or YAML) |
| `--out, -o` | Output directory (default: `./apilot-dist`) |
| `--title, -t` | Custom page title |
| `--single-file` | Output a single self-contained HTML file |
| `--lang` | Default language (`en`, `zh_CN`, `zh_HK`, `zh_TW`, `ja`, `ko`) |

### API Querying

Query OpenAPI specs from the command line — list endpoints, inspect schemas, send requests.

```bash
# List all endpoints
apilot route list --spec openapi.yaml

# Filter by tag
apilot route list --spec openapi.yaml --tag config

# Show endpoint details (parameters, request body, responses)
apilot route show --spec openapi.yaml --method POST --path /api/configs

# Show a schema definition
apilot schema show --spec openapi.yaml --name ConfigItem

# Send a request to a configured environment
apilot request send --spec openapi.yaml --env dev --method GET --path /api/configs

# Manage environments
apilot env add dev --url https://dev-api.example.com --auth-type bearer --auth-token '{{DEV_TOKEN}}'
apilot env list
```

### MCP Server for AI Agents

Apilot provides an MCP (Model Context Protocol) server that lets AI agents query OpenAPI specs and send HTTP requests without loading the full spec into context.

```bash
# Start the MCP server (stdio transport)
apilot serve
```

**Configure in Claude Code** (`.mcp.json`):

```json
{
  "mcpServers": {
    "apilot": {
      "command": "npx",
      "args": ["@yuerchu/apilot", "serve"]
    }
  }
}
```

**Available MCP tools:**

| Tool | Description |
|------|-------------|
| `apilot_spec_load` | Load a spec from file path or URL |
| `apilot_route_list` | List endpoints with tag/method/keyword filter |
| `apilot_route_show` | Show endpoint details (params, schemas) |
| `apilot_schema_show` | Show a named schema definition |
| `apilot_request_send` | Send HTTP request to a configured environment |
| `apilot_env_list` | List configured environments |
| `apilot_generate_example` | Generate example request body from schema |

**Environment config** (`apilot.config.json`):

```json
{
  "version": 1,
  "defaultSpec": "./openapi.yaml",
  "environments": {
    "dev": {
      "baseUrl": "https://dev-api.example.com",
      "auth": { "type": "bearer", "token": "{{DEV_API_TOKEN}}" }
    },
    "test": {
      "baseUrl": "https://test-api.example.com",
      "auth": { "type": "bearer", "token": "{{TEST_API_TOKEN}}" }
    }
  }
}
```

See [`skills/apilot-mcp.md`](skills/apilot-mcp.md) for detailed usage guide.

### GitHub Actions Example

```yaml
- run: npx @yuerchu/apilot build --spec openapi.json --out docs/ --title "My API"
- uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./docs
```

## FastAPI Integration

See [openapi-advance-python](https://github.com/Yuerchu/openapi-advance-python) for the Python package that replaces FastAPI's built-in Swagger UI:

```python
from fastapi import FastAPI
from openapi_advance import setup_docs

app = FastAPI(docs_url=None)
setup_docs(app)
```

## Tech Stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Shadcn/ui** (Radix Nova style) — 20+ components
- **Tailwind CSS v4** with OKLCH color system
- **CodeMirror 6** — JSON editor
- **TanStack Virtual** — Virtualized lists for large specs
- **Motion** (Framer Motion) + **animate-ui** — Animations
- **idb** — IndexedDB wrapper for persistent storage
- **react-i18next** — Internationalization (6 languages)
- **Sonner** — Toast notifications
- **marked** — Markdown rendering
- **vite-plugin-singlefile** — Single HTML output

## Project Structure

```
src/
├── components/
│   ├── ui/              # Shadcn components (20+)
│   ├── animate-ui/      # Animated components (motion-powered)
│   ├── layout/          # AppSidebar, Header, EnvironmentSwitcher, ViewToolbar, SelectionFab
│   ├── endpoints/       # RouteCard, EndpointsView, FavoritesView, TryTab, DocTab, HistoryTab
│   ├── models/          # ModelsView, ModelCard, ModelGraphView
│   ├── schema/          # SchemaViewerView, SchemaTree, SchemaForm, SchemaInput
│   ├── settings/        # SettingsDialog, ConnectionSettings, AuthSettings, StorageSettings
│   ├── tools/           # ProjectToolsView (Diagnostics, Diff)
│   ├── search/          # CommandPalette
│   ├── share/           # ShareDialog
│   └── editor/          # JsonEditor, CodeViewer
├── hooks/               # useOpenAPI, useAuth, useRequest, useSettings, useEnvironments,
│                        #   useFavorites, useMultiEnvStatus
├── contexts/            # OpenAPIContext, AuthContext
├── lib/
│   └── openapi/         # Parser, ref resolution, schema processing, route extraction, diff
└── locales/             # en, zh_CN, zh_TW, zh_HK, ja, ko
```

## License

MIT
