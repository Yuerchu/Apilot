import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"

export type CrudOp = "list" | "create" | "read" | "update" | "delete"

export type PageType = "table" | "detail" | "form" | "editor" | "action"

export interface ResourceAction {
  route: ParsedRoute
  routeIndex: number
  label: string
  kind: "crud" | "action"
  crudOp?: CrudOp
}

export interface DiagnosticHint {
  code:
    | "ambiguous-grouping"
    | "missing-list-endpoint"
    | "missing-create-schema"
    | "missing-id-param"
    | "non-restful-endpoint"
    | "nested-resource"
    | "pagination-unknown"
  message: string
  suggestion: string
  resource?: string
  field?: string
}

export interface ConsoleResource {
  name: string
  displayName: string
  basePath: string
  tag: string | null
  idParam: string | null
  pageType: PageType
  operations: Partial<Record<CrudOp, ResourceAction>>
  actions: ResourceAction[]
  listItemSchema: SchemaObject | null
  createSchema: SchemaObject | null
  updateSchema: SchemaObject | null
  detailSchema: SchemaObject | null
  confidence: number
  hints: DiagnosticHint[]
  parent: string | null
}

export interface ConsoleResourceGroup {
  label: string
  resources: ConsoleResource[]
}

export interface PaginationConfig {
  style: "offset" | "cursor" | "page" | "none"
  itemsField: string | null
  totalField: string | null
}
