# Apilot MCP — OpenAPI Query & Request Tools

When working with REST APIs that have an OpenAPI/Swagger spec, use the apilot MCP tools to inspect endpoints and send requests — without loading the full spec into context.

## When to use

- User says "look at the API" / "what endpoints are available" / "check the spec"
- User wants to migrate data between environments ("copy config from dev to test")
- User needs to understand an API's request/response structure before writing code
- User wants to test an API endpoint directly
- The OpenAPI spec is large (1MB+) and would blow context if loaded as text

## Available tools

| Tool | Purpose |
|------|---------|
| `apilot_spec_load` | Load an OpenAPI/Swagger spec from file path or URL |
| `apilot_route_list` | List endpoints with optional tag/method/keyword filter |
| `apilot_route_show` | Show full details of one endpoint (params, request body, responses) |
| `apilot_schema_show` | Show a named model from components/schemas |
| `apilot_request_send` | Send a real HTTP request to an endpoint on a named environment |
| `apilot_env_list` | List configured environments from apilot.config.json |
| `apilot_generate_example` | Generate example request body from schema |

## Typical workflow

### 1. Discover

```
apilot_spec_load({ source: "./openapi.yaml" })
→ "Config Service v1.0.0 — 42 routes, tags: config, users, auth"

apilot_route_list({ tag: "config" })
→ GET   /api/configs      List all configurations  [config]
  POST  /api/configs      Create a configuration   [config]
  PATCH /api/configs/{id} Update a configuration   [config]
```

### 2. Inspect

```
apilot_route_show({ method: "GET", path: "/api/configs" })
→ GET /api/configs
  Parameters:
    page (query): integer — Page number
  Responses:
    200: array
      items: object
        id (required): string
        key (required): string
        value (required): string
```

### 3. Execute

```
apilot_request_send({
  method: "GET",
  path: "/api/configs",
  env: "dev"
})
→ HTTP 200 OK (142ms)
  Response Body:
  [{"id": "1", "key": "feature_x", "value": "true"}, ...]
```

### 4. Migrate

```
apilot_request_send({
  method: "POST",
  path: "/api/configs",
  env: "test",
  body: "{\"key\": \"feature_x\", \"value\": \"true\"}"
})
→ HTTP 201 Created (89ms)
```

## Environment configuration

Environments are defined in `apilot.config.json` at the project root:

```json
{
  "version": 1,
  "defaultSpec": "./openapi.yaml",
  "environments": {
    "dev": {
      "baseUrl": "https://dev-api.example.com",
      "stage": "development",
      "auth": {
        "type": "bearer",
        "token": "{{DEV_API_TOKEN}}"
      },
      "variables": {
        "tenantId": "dev-tenant-001"
      }
    },
    "test": {
      "baseUrl": "https://test-api.example.com",
      "stage": "testing",
      "auth": {
        "type": "bearer",
        "token": "{{TEST_API_TOKEN}}"
      }
    }
  }
}
```

- `{{VAR}}` in auth tokens resolves from `process.env` at runtime
- `variables` values are substituted into `{{var}}` placeholders in request bodies and URLs
- `defaultSpec` lets you omit the `specId` parameter from tool calls

## Tips

- Always `apilot_spec_load` first — other tools need a loaded spec
- If only one spec is loaded, `specId` is optional in all tools
- Use `apilot_route_list` with `search` for keyword-based discovery ("config", "user", "auth")
- Use `apilot_generate_example` to get a valid request body scaffold before sending
- `apilot_route_show` output uses `formatSchema` — compact indented text, not JSON
- For data migration: GET from source env, then POST/PUT to target env with the response body
