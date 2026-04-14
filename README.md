# Apilot

A modern, feature-rich OpenAPI documentation viewer and API testing tool. Built with React, TypeScript, Shadcn/ui, and Tailwind CSS.

**Live Demo**: [openapi.yxqi.cn](https://openapi.yxqi.cn)

## Features

- **Schema-driven forms** — Auto-renders inputs based on OpenAPI schema types (text, number, boolean, enum, date picker, file upload, UUID generator)
- **Live API testing** — Send requests directly from the browser with parameter validation, auth headers, and response display
- **JSON editor** — CodeMirror 6 with syntax highlighting, bidirectional sync with schema form
- **Structured schema display** — Three-column table view (Field / Type / Description) with nested object support
- **Data model browser** — Browse all schema definitions with cross-references to endpoints
- **Model ↔ Endpoint linking** — See which models an endpoint uses, and which endpoints reference a model
- **Curl generation** — Auto-generated curl command with one-click copy
- **Token extraction** — Detect token fields in login responses and apply as Bearer auth with one click
- **Multiple auth methods** — Bearer, Basic, API Key, OAuth2 Password flow
- **Swagger 2.0 / OpenAPI 3.0 / 3.1 compatible** — Auto-converts Swagger 2.0 specs
- **Dark theme** — OKLCH color system with custom scrollbar styling
- **i18n** — Chinese and English, switchable in sidebar, persisted to localStorage
- **Animations** — Smooth transitions powered by Motion and animate-ui
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
| `lang` | Set language (`zh`, `en`) | `&lang=en` |

## Build

```bash
pnpm build        # Production build → dist/index.html (single file)
pnpm lint         # ESLint
pnpm typecheck    # TypeScript type check
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
- **Shadcn/ui** (new-york style) — 15+ components
- **Tailwind CSS v4** with OKLCH color system
- **CodeMirror 6** — JSON editor
- **Motion** (Framer Motion) + **animate-ui** — Animations
- **react-i18next** — Internationalization
- **Sonner** — Toast notifications
- **marked** — Markdown rendering
- **vite-plugin-singlefile** — Single HTML output

## Project Structure

```
src/
├── components/
│   ├── ui/              # Shadcn components
│   ├── animate-ui/      # Animated components (motion-powered)
│   ├── layout/          # AppSidebar, Header, ViewToolbar, SelectionFab
│   ├── endpoints/       # RouteCard, TryTab, DocTab, ResponsePanel, TagFilter
│   ├── models/          # ModelsView, ModelCard
│   ├── schema/          # SchemaTree, SchemaForm
│   └── editor/          # JsonEditor (CodeMirror)
├── hooks/               # useOpenAPI, useAuth, useRequest, useSettings
├── contexts/            # OpenAPIContext, AuthContext
├── lib/
│   └── openapi/         # Pure TS logic (ref resolution, schema processing, v2 conversion)
└── locales/             # zh.ts, en.ts
```

## License

MIT
