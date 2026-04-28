# Apilot — OpenAPI / AsyncAPI Documentation Viewer

When the user wants to view, browse, or share an OpenAPI or AsyncAPI specification document, open it in Apilot.

Apilot is deployed at **https://openapi.yxqi.cn**.

## When to use

- User says "help me view this API doc" / "open this spec" / "show me the API"
- User has an OpenAPI (Swagger) or AsyncAPI spec URL and wants to browse it interactively
- User wants to share an API documentation link with someone
- User wants to test API endpoints or WebSocket channels

## URL Parameters

### Query parameters (`?key=value`)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `openapi_url` | URL to the OpenAPI or AsyncAPI spec (JSON/YAML). Apilot auto-detects the spec type. | `?openapi_url=https://petstore3.swagger.io/api/v3/openapi.json` |
| `base_url` | Override the API base URL for testing requests | `?base_url=https://api.example.com` |
| `auth_type` | Pre-set auth type: `bearer`, `basic`, `apikey`, `oauth2` | `?auth_type=bearer` |
| `auth_token` | Pre-fill the auth token | `?auth_token=eyJhbG...` |
| `title` | Override the browser tab title | `?title=My%20API` |

### Hash parameters (`#/view?key=value`)

The hash controls which view and item is selected:

**Endpoints view** — `#/endpoints`
| Parameter | Description |
|-----------|-------------|
| `q` | Search filter text |
| `tag` | Filter by tag (can repeat for multiple tags) |
| `endpoint` | Active endpoint key, format: `method:path` (e.g. `get:/api/users`) |
| `tab` | Detail tab: `doc` (default), `try`, `history` |

**Data Models view** — `#/models`
| Parameter | Description |
|-----------|-------------|
| `q` | Search filter text |
| `category` | Filter by category |
| `type` | Filter by response type |
| `schema` | Active schema name |
| `source` | Source: `openapi` (default) or `external` |
| `mode` | View mode: `list` (default) or `graph` |

**WebSocket Channels view** — `#/channels`
(shown when an AsyncAPI spec is loaded)

**Other views**: `#/diagnostics`, `#/diff`

## URL construction examples

```
# Basic: open a spec
https://openapi.yxqi.cn?openapi_url=https://api.example.com/openapi.json

# With base URL override
https://openapi.yxqi.cn?openapi_url=https://api.example.com/openapi.json&base_url=https://staging.example.com

# Deep link to a specific endpoint
https://openapi.yxqi.cn?openapi_url=https://api.example.com/openapi.json#/endpoints?endpoint=post:/api/v1/chat/completions&tab=try

# Deep link to a data model
https://openapi.yxqi.cn?openapi_url=https://api.example.com/openapi.json#/models?schema=UserResponse

# With auth pre-filled
https://openapi.yxqi.cn?openapi_url=https://api.example.com/openapi.json&auth_type=bearer&auth_token=sk-xxx

# Custom title
https://openapi.yxqi.cn?openapi_url=https://api.example.com/openapi.json&title=My%20Service%20API
```

## How to open

Use the user's browser to navigate to the constructed URL. If you have access to browser tools (MCP, Playwright, etc.), open a new tab. Otherwise, provide the URL for the user to click.

## Notes

- Apilot auto-detects whether a spec is OpenAPI or AsyncAPI
- Supports OpenAPI 2.0 (Swagger), 3.0, and 3.1
- Supports AsyncAPI 3.0 with WebSocket channel browsing and testing
- The spec URL must be accessible from the user's browser (CORS must allow it)
- Apilot is a PWA — after first visit, it works offline and loads instantly
