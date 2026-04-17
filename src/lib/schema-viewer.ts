import { parse } from "yaml"
import type { OpenAPISpec, SchemaObject } from "@/lib/openapi/types"

export interface SchemaConstraintClause {
  field: string
  operator: string
  value: unknown
}

export interface SchemaCrossFieldRule {
  conditions: SchemaConstraintClause[]
  actions: SchemaConstraintClause[]
}

export type SchemaFieldRuleRole = "condition" | "action" | "both"

export interface SchemaFieldDynamicRule {
  index: number
  role: SchemaFieldRuleRole
  conditions: SchemaConstraintClause[]
  actions: SchemaConstraintClause[]
}

export interface SchemaFileAcceptRule {
  mimeType: string
  limits: Record<string, unknown>
}

export interface SchemaFileConstraint {
  field: string
  accepts: SchemaFileAcceptRule[]
  maxCount: number | null
  maxTotalSize: number | null
  role: string
}

export interface SchemaStandardRule {
  path: string
  keyword: "if/then/else" | "dependentRequired" | "dependentSchemas"
  detail: string
}

export interface SchemaViewerItem {
  id: string
  name: string
  schema: SchemaObject
  description: string
  category: string
  responseType: string
  endpoint: string
  crossFieldRules: SchemaCrossFieldRule[]
  fileConstraints: SchemaFileConstraint[]
  standardRules: SchemaStandardRule[]
}

export interface SchemaFieldExtension {
  field: string
  fileConstraint: SchemaFileConstraint | null
  dynamicRules: SchemaFieldDynamicRule[]
}

const SCHEMA_HINT_KEYS = new Set([
  "$ref",
  "additionalProperties",
  "allOf",
  "anyOf",
  "const",
  "enum",
  "format",
  "items",
  "oneOf",
  "pattern",
  "properties",
  "required",
  "type",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === "string" ? value : ""
}

function getNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isSchemaLike(value: unknown): value is SchemaObject {
  if (!isRecord(value)) return false
  for (const key of Object.keys(value)) {
    if (SCHEMA_HINT_KEYS.has(key)) return true
  }
  return false
}

function toConstraintClauses(value: unknown): SchemaConstraintClause[] {
  const values = Array.isArray(value) ? value : [value]
  const clauses: SchemaConstraintClause[] = []

  for (const item of values) {
    if (!isRecord(item)) continue
    const field = getStringField(item, "field")
    if (!field) continue

    for (const [operator, operatorValue] of Object.entries(item)) {
      if (operator === "field") continue
      clauses.push({ field, operator, value: operatorValue })
    }
  }

  return clauses
}

export function normalizeCrossFieldRules(value: unknown): SchemaCrossFieldRule[] {
  if (!Array.isArray(value)) return []

  const rules: SchemaCrossFieldRule[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const conditions = toConstraintClauses(item.when)
    const actions = toConstraintClauses(item.then)
    if (conditions.length === 0 || actions.length === 0) continue
    rules.push({ conditions, actions })
  }

  return rules
}

export function normalizeFileConstraints(value: unknown): SchemaFileConstraint[] {
  if (!isRecord(value) || !isRecord(value.constraints)) return []

  const constraints: SchemaFileConstraint[] = []
  for (const [field, rawRule] of Object.entries(value.constraints)) {
    if (!isRecord(rawRule)) continue

    const accepts: SchemaFileAcceptRule[] = []
    if (isRecord(rawRule.accept)) {
      for (const [mimeType, rawLimits] of Object.entries(rawRule.accept)) {
        accepts.push({
          mimeType,
          limits: isRecord(rawLimits) ? rawLimits : {},
        })
      }
    }

    constraints.push({
      field,
      accepts,
      maxCount: getNumberField(rawRule, "max_count"),
      maxTotalSize: getNumberField(rawRule, "max_total_size"),
      role: getStringField(rawRule, "role"),
    })
  }

  return constraints
}

function addStandardRulesFromSchema(schema: SchemaObject, path: string, rules: SchemaStandardRule[]) {
  if (schema.if || schema.then || schema.else) {
    rules.push({
      path,
      keyword: "if/then/else",
      detail: "conditional schema",
    })
  }

  if (isRecord(schema.dependentRequired)) {
    for (const [field, dependencies] of Object.entries(schema.dependentRequired)) {
      const fields = Array.isArray(dependencies) ? dependencies.map(String).join(", ") : ""
      rules.push({
        path,
        keyword: "dependentRequired",
        detail: fields ? `${field} -> ${fields}` : field,
      })
    }
  }

  if (isRecord(schema.dependentSchemas)) {
    for (const field of Object.keys(schema.dependentSchemas)) {
      rules.push({
        path,
        keyword: "dependentSchemas",
        detail: field,
      })
    }
  }

  if (schema.properties) {
    for (const [name, child] of Object.entries(schema.properties)) {
      addStandardRulesFromSchema(child, `${path}/properties/${name}`, rules)
    }
  }

  if (schema.items && typeof schema.items === "object") {
    addStandardRulesFromSchema(schema.items, `${path}/items`, rules)
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    const items = schema[key]
    if (!items) continue
    items.forEach((item, index) => addStandardRulesFromSchema(item, `${path}/${key}/${index}`, rules))
  }
}

export function normalizeStandardSchemaRules(schema: SchemaObject): SchemaStandardRule[] {
  const rules: SchemaStandardRule[] = []
  addStandardRulesFromSchema(schema, "#", rules)
  return rules
}

function ensureFieldExtension(
  extensions: Map<string, SchemaFieldExtension>,
  field: string,
): SchemaFieldExtension {
  const existing = extensions.get(field)
  if (existing) return existing

  const next: SchemaFieldExtension = {
    field,
    fileConstraint: null,
    dynamicRules: [],
  }
  extensions.set(field, next)
  return next
}

function clausesContainField(clauses: SchemaConstraintClause[], field: string): boolean {
  return clauses.some(clause => clause.field === field)
}

export function buildSchemaFieldExtensions(item: SchemaViewerItem): Map<string, SchemaFieldExtension> {
  const extensions = new Map<string, SchemaFieldExtension>()

  for (const fileConstraint of item.fileConstraints) {
    ensureFieldExtension(extensions, fileConstraint.field).fileConstraint = fileConstraint
  }

  item.crossFieldRules.forEach((rule, index) => {
    const fields = new Set([
      ...rule.conditions.map(clause => clause.field),
      ...rule.actions.map(clause => clause.field),
    ])

    for (const field of fields) {
      const inConditions = clausesContainField(rule.conditions, field)
      const inActions = clausesContainField(rule.actions, field)
      ensureFieldExtension(extensions, field).dynamicRules.push({
        index,
        role: inConditions && inActions ? "both" : inConditions ? "condition" : "action",
        conditions: rule.conditions,
        actions: rule.actions,
      })
    }
  })

  return extensions
}

function getSchemaDescription(schema: SchemaObject): string {
  return typeof schema.description === "string" ? schema.description : ""
}

function getSchemaTitle(schema: SchemaObject): string {
  return typeof schema.title === "string" ? schema.title : ""
}

function makeUniqueId(baseId: string, usedIds: Set<string>): string {
  const normalized = baseId.trim() || "schema"
  if (!usedIds.has(normalized)) {
    usedIds.add(normalized)
    return normalized
  }

  let index = 2
  let next = `${normalized}-${index}`
  while (usedIds.has(next)) {
    index += 1
    next = `${normalized}-${index}`
  }
  usedIds.add(next)
  return next
}

function normalizeSchemaMap(map: Record<string, unknown>): SchemaViewerItem[] {
  const usedIds = new Set<string>()
  const items: SchemaViewerItem[] = []

  for (const [name, value] of Object.entries(map)) {
    if (!isSchemaLike(value)) continue
    const title = getSchemaTitle(value)
    const displayName = title || name
    items.push({
      id: makeUniqueId(name, usedIds),
      name: displayName,
      schema: value,
      description: getSchemaDescription(value),
      category: "",
      responseType: "",
      endpoint: "",
      crossFieldRules: [],
      fileConstraints: [],
      standardRules: normalizeStandardSchemaRules(value),
    })
  }

  return items
}

function normalizeGeneratorArray(value: unknown[]): SchemaViewerItem[] {
  const usedIds = new Set<string>()
  const items: SchemaViewerItem[] = []

  value.forEach((entry, index) => {
    if (!isRecord(entry)) return
    const schemaValue = entry.schema
    if (!isSchemaLike(schemaValue)) return

    const name = getStringField(entry, "name") || getSchemaTitle(schemaValue) || `schema-${index + 1}`
    const rawId = getStringField(entry, "id") || name
    items.push({
      id: makeUniqueId(rawId, usedIds),
      name,
      schema: schemaValue,
      description: getSchemaDescription(schemaValue),
      category: getStringField(entry, "category"),
      responseType: getStringField(entry, "response_type"),
      endpoint: getStringField(entry, "endpoint"),
      crossFieldRules: normalizeCrossFieldRules(entry.x_constraints),
      fileConstraints: normalizeFileConstraints(entry.file_constraints),
      standardRules: normalizeStandardSchemaRules(schemaValue),
    })
  })

  return items
}

export function getOpenAPISchemaViewerItems(spec: OpenAPISpec): SchemaViewerItem[] {
  const schemas = spec.components?.schemas || spec.definitions || {}
  return normalizeSchemaMap(schemas)
}

export function normalizeSchemaViewerDocument(value: unknown, fallbackName: string): SchemaViewerItem[] {
  if (Array.isArray(value)) return normalizeGeneratorArray(value)

  if (!isRecord(value)) return []

  const components = value.components
  if (isRecord(components) && isRecord(components.schemas)) {
    return normalizeSchemaMap(components.schemas)
  }

  const schemas = value.schemas
  if (isRecord(schemas)) {
    return normalizeSchemaMap(schemas)
  }

  if (isSchemaLike(value)) {
    const name = getSchemaTitle(value) || fallbackName
    return [{
      id: name,
      name,
      schema: value,
      description: getSchemaDescription(value),
      category: "",
      responseType: "",
      endpoint: "",
      crossFieldRules: [],
      fileConstraints: [],
      standardRules: normalizeStandardSchemaRules(value),
    }]
  }

  return normalizeSchemaMap(value)
}

export function parseSchemaViewerDocument(text: string, fallbackName: string): SchemaViewerItem[] {
  return normalizeSchemaViewerDocument(parse(text) as unknown, fallbackName)
}

function decodePointerSegment(segment: string): string {
  return decodeURIComponent(segment.replace(/~1/g, "/").replace(/~0/g, "~"))
}

export function getSchemaRefName(ref: string): string {
  if (!ref.startsWith("#/")) return ""
  const segments = ref.slice(2).split("/").map(decodePointerSegment)
  const schemaIndex = segments.findIndex((segment, index) => (
    segment === "schemas" && segments[index - 1] === "components"
  ))
  if (schemaIndex !== -1) return segments[schemaIndex + 1] || ""

  const definitionsIndex = segments.findIndex(segment => segment === "definitions")
  if (definitionsIndex !== -1) return segments[definitionsIndex + 1] || ""

  return segments[segments.length - 1] || ""
}

export function createSchemaLookup(items: SchemaViewerItem[]): Map<string, SchemaObject> {
  const lookup = new Map<string, SchemaObject>()
  for (const item of items) {
    lookup.set(item.id, item.schema)
    lookup.set(item.name, item.schema)
  }
  return lookup
}
