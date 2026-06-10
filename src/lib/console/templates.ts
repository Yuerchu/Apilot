import type { ConsoleResource, ResourceAction } from "./types"
import { getRequestBodySchema } from "./schema-inference"

export interface PageTemplate {
  id: string
  name: string
  category: "auth" | "crud" | "form" | "detail" | "action"
  matchScore: (resource: ConsoleResource) => number
}

const AUTH_PATH_KEYWORDS = ["auth", "login", "signin", "sign-in", "token", "session", "oauth"]
const REGISTER_PATH_KEYWORDS = ["register", "signup", "sign-up", "create-account"]
const UPLOAD_PATH_KEYWORDS = ["upload", "file", "attachment", "media", "image", "photo"]
const STATS_PATH_KEYWORDS = ["stats", "statistics", "metrics", "dashboard", "analytics", "summary", "overview", "count"]
const CONFIG_PATH_KEYWORDS = ["config", "settings", "preferences", "options", "profile"]
const SEARCH_PATH_KEYWORDS = ["search", "query", "find", "lookup"]
const PASSWORD_PATH_KEYWORDS = ["password", "change-password", "reset-password", "change_password"]

function pathContains(basePath: string, keywords: string[]): boolean {
  const segments = basePath.toLowerCase().split("/").filter(Boolean).filter(s => !s.startsWith("{"))
  return keywords.some(k => segments.some(seg => seg === k || seg.endsWith(`-${k}`) || seg.startsWith(`${k}-`)))
}

function hasRequestBodyAction(resource: ConsoleResource): boolean {
  return resource.actions.some(a => !!getRequestBodySchema(a.route))
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "crud-table",
    name: "console.template.crudTable",
    category: "crud",
    matchScore: (r) => r.operations.list ? 1.0 : 0,
  },
  {
    id: "login-card",
    name: "console.template.loginCard",
    category: "auth",
    matchScore: (r) => {
      if (r.operations.list || r.operations.read || r.operations.update) return 0
      if (!pathContains(r.basePath, AUTH_PATH_KEYWORDS)) return 0
      if (hasRequestBodyAction(r) || r.operations.create) return 0.95
      return 0.5
    },
  },
  {
    id: "register-form",
    name: "console.template.registerForm",
    category: "auth",
    matchScore: (r) => {
      if (!pathContains(r.basePath, REGISTER_PATH_KEYWORDS)) return 0
      if (hasRequestBodyAction(r) || r.operations.create) return 0.95
      return 0.4
    },
  },
  {
    id: "detail-card",
    name: "console.template.detailCard",
    category: "detail",
    matchScore: (r) => {
      if (r.operations.list) return 0
      if (r.operations.read) return 0.85
      return 0
    },
  },
  {
    id: "editor-split",
    name: "console.template.editorSplit",
    category: "detail",
    matchScore: (r) => {
      if (r.operations.list) return 0
      if (r.operations.read && r.operations.update) return 0.9
      return 0
    },
  },
  {
    id: "form-centered",
    name: "console.template.formCentered",
    category: "form",
    matchScore: (r) => {
      if (r.operations.list) return 0
      if (r.operations.create && r.createSchema) return 0.8
      if (r.actions.length === 1 && hasRequestBodyAction(r)) return 0.75
      return 0
    },
  },
  {
    id: "upload-dropzone",
    name: "console.template.uploadDropzone",
    category: "form",
    matchScore: (r) => {
      if (r.operations.list) return 0
      if (pathContains(r.basePath, UPLOAD_PATH_KEYWORDS)) {
        if (hasRequestBodyAction(r) || r.operations.create) return 0.9
        return 0.6
      }
      return 0
    },
  },
  {
    id: "stats-dashboard",
    name: "console.template.statsDashboard",
    category: "detail",
    matchScore: (r) => {
      if (r.operations.list) return 0
      if (pathContains(r.basePath, STATS_PATH_KEYWORDS)) return 0.9
      return 0
    },
  },
  {
    id: "config-form",
    name: "console.template.configForm",
    category: "form",
    matchScore: (r) => {
      if (r.operations.list) return 0
      if (pathContains(r.basePath, CONFIG_PATH_KEYWORDS) && (r.operations.read || r.operations.update)) return 0.9
      return 0
    },
  },
  {
    id: "search-results",
    name: "console.template.searchResults",
    category: "crud",
    matchScore: (r) => {
      if (pathContains(r.basePath, SEARCH_PATH_KEYWORDS)) return 0.85
      const hasSearchParam = r.operations.list?.route.parameters.some(p =>
        p.in === "query" && ["q", "query", "search", "keyword"].includes(p.name.toLowerCase())
      )
      if (hasSearchParam) return 0.7
      return 0
    },
  },
  {
    id: "password-change",
    name: "console.template.passwordChange",
    category: "auth",
    matchScore: (r) => {
      if (r.operations.list) return 0
      if (pathContains(r.basePath, PASSWORD_PATH_KEYWORDS)) return 0.95
      return 0
    },
  },
  {
    id: "action-form",
    name: "console.template.actionForm",
    category: "action",
    matchScore: (r) => {
      if (r.operations.list || r.operations.read) return 0
      if (r.actions.length >= 1 && hasRequestBodyAction(r)) return 0.7
      return 0
    },
  },
  {
    id: "action-list",
    name: "console.template.actionList",
    category: "action",
    matchScore: (r) => {
      if (r.operations.list || r.operations.read) return 0
      if (r.actions.length > 0) return 0.5
      return 0.1
    },
  },
]

export function selectActionTemplate(action: ResourceAction): PageTemplate {
  const method = action.route.method.toUpperCase()
  const hasBody = !!getRequestBodySchema(action.route)
  const path = action.route.path.toLowerCase()

  if (pathContains(path, AUTH_PATH_KEYWORDS) && hasBody) return PAGE_TEMPLATES.find(t => t.id === "login-card")!
  if (pathContains(path, PASSWORD_PATH_KEYWORDS)) return PAGE_TEMPLATES.find(t => t.id === "password-change")!
  if (pathContains(path, UPLOAD_PATH_KEYWORDS) && (method === "POST" || method === "PUT")) return PAGE_TEMPLATES.find(t => t.id === "upload-dropzone")!
  if (pathContains(path, STATS_PATH_KEYWORDS) && method === "GET") return PAGE_TEMPLATES.find(t => t.id === "stats-dashboard")!
  if (pathContains(path, SEARCH_PATH_KEYWORDS) && method === "GET") return PAGE_TEMPLATES.find(t => t.id === "search-results")!

  if (hasBody) return PAGE_TEMPLATES.find(t => t.id === "action-form")!
  if (method === "GET") return PAGE_TEMPLATES.find(t => t.id === "detail-card")!

  return PAGE_TEMPLATES.find(t => t.id === "action-form")!
}

export function selectBestTemplate(resource: ConsoleResource, overrideId?: string | undefined): PageTemplate {
  if (overrideId) {
    const found = PAGE_TEMPLATES.find(t => t.id === overrideId)
    if (found) return found
  }

  let best = PAGE_TEMPLATES[PAGE_TEMPLATES.length - 1]!
  let bestScore = -1

  for (const tpl of PAGE_TEMPLATES) {
    const score = tpl.matchScore(resource)
    if (score > bestScore) {
      bestScore = score
      best = tpl
    }
  }

  return best
}
