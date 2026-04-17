import {
  SchemaTree,
  isBooleanishNode,
  isReferenceNode,
  isRegularNode,
  type RegularNode,
  type SchemaFragment,
  type SchemaNode,
  type SchemaTreeRefDereferenceFn,
} from "@stoplight/json-schema-tree"
import type { SchemaObject } from "@/lib/openapi/types"
import { getSchemaRefName } from "@/lib/schema-viewer"

export type JsonSchemaTypeCombiner = "allOf" | "anyOf" | "oneOf"

export interface JsonSchemaTypeInfo {
  summary: string
  format: string
  combiner: JsonSchemaTypeCombiner | ""
  variantCount: number
}

export interface JsonSchemaConstraintInfo {
  keyword: string
  value: string
  labelKey: string
  rawLabel: string
  monospace: boolean
}

export interface JsonSchemaTreeNode {
  id: string
  name: string
  path: string
  typeLabel: string
  typeInfo: JsonSchemaTypeInfo
  description: string
  required: boolean
  deprecated: boolean
  enumValues: string[]
  validations: string[]
  constraints: JsonSchemaConstraintInfo[]
  defaultValue: string
  children: JsonSchemaTreeNode[]
}

function stringifyValue(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function getPath(node: SchemaNode): string {
  return node.path.length ? `#/${node.path.join("/")}` : "#"
}

function getPropertyName(node: SchemaNode): string | null {
  for (let index = node.path.length - 2; index >= 0; index -= 1) {
    const segment = node.path[index]
    if (segment === "properties" || segment === "patternProperties") {
      return node.path[index + 1] || null
    }
  }
  return null
}

function getNodeName(node: SchemaNode): string {
  const propertyName = getPropertyName(node)
  if (propertyName) return propertyName

  const last = node.path[node.path.length - 1]
  const previous = node.path[node.path.length - 2]
  if (previous === "oneOf" || previous === "anyOf" || previous === "allOf") {
    return `${previous} #${Number(last) + 1}`
  }
  if (last === "items") return "items"
  if (!last) return "schema"
  return last
}

function isRequired(node: SchemaNode): boolean {
  const propertyName = getPropertyName(node)
  if (!propertyName || !node.parent || !isRegularNode(node.parent)) return false
  return node.parent.required?.includes(propertyName) ?? false
}

function getTypeLabel(node: RegularNode): string {
  const types = node.types?.join(" | ") || node.primaryType || "any"
  const format = node.format ? `(${node.format})` : ""
  const combiner = node.combiners?.join(" | ")
  return [types, format, combiner].filter(Boolean).join(" ")
}

function getCombiner(node: RegularNode): JsonSchemaTypeCombiner | "" {
  const combiner = node.combiners?.[0]
  return combiner === "allOf" || combiner === "anyOf" || combiner === "oneOf" ? combiner : ""
}

function getEnumTypeLabel(values: unknown[] | null): string {
  if (!values?.length) return ""
  const types = unique(values.map(value => {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    if (typeof value === "number" && Number.isInteger(value)) return "integer"
    return typeof value
  }))
  return `enum<${types.join(" | ")}>`
}

function getArraySummary(children: JsonSchemaTreeNode[]): string {
  const item = children.find(child => child.path.endsWith("/items"))
  return item ? `array<${item.typeInfo.summary}>` : "array"
}

function getBaseTypeSummary(node: RegularNode, children: JsonSchemaTreeNode[]): string {
  const types = unique(node.types ?? (node.primaryType ? [node.primaryType] : []))
  const normalized = types.length ? types : ["any"]
  const hasOnlyAny = normalized.length === 1 && normalized[0] === "any"

  if (hasOnlyAny) {
    return getEnumTypeLabel(node.enum) || "any"
  }

  return normalized.map(type => {
    if (type === "array") return getArraySummary(children)
    return type
  }).join(" | ")
}

function getTypeInfo(node: RegularNode, children: JsonSchemaTreeNode[]): JsonSchemaTypeInfo {
  const combiner = getCombiner(node)
  if (combiner) {
    const variantSummaries = unique(children.map(child => child.typeInfo.summary))
    return {
      summary: variantSummaries.length ? variantSummaries.join(" | ") : getBaseTypeSummary(node, children),
      format: node.format || "",
      combiner,
      variantCount: children.length,
    }
  }

  return {
    summary: getBaseTypeSummary(node, children),
    format: node.format || "",
    combiner: "",
    variantCount: 0,
  }
}

function getDescription(node: RegularNode): string {
  const description = node.annotations.description
  return typeof description === "string" ? description : ""
}

function getDefaultValue(node: RegularNode): string {
  if (!("default" in node.annotations)) return ""
  return stringifyValue(node.annotations.default)
}

function getEnumValues(node: RegularNode): string[] {
  return node.enum?.map(stringifyValue) ?? []
}

function getPatternLabelKey(value: string): string {
  const normalized = value.split(String.fromCharCode(0)).join("\\x00").replace(/\s+/g, "")
  if (normalized === "^[^\\x00]*$" || normalized === "^[^\\u0000]*$") return "patternNoNull"
  if (normalized === "^\\S*$") return "patternNoWhitespaceOptional"
  if (normalized === "^\\S+$") return "patternNoWhitespace"
  if (normalized === "^\\d+$") return "patternDigits"
  if (normalized === "^[a-zA-Z0-9_-]+$") return "patternIdentifier"
  if (normalized === "^[a-z0-9-]+$") return "patternSlug"
  return "pattern"
}

function getConstraintLabelKey(keyword: string, value: unknown): string {
  if (keyword === "pattern" && typeof value === "string") return getPatternLabelKey(value)

  switch (keyword) {
    case "minLength":
    case "maxLength":
    case "minimum":
    case "exclusiveMinimum":
    case "maximum":
    case "exclusiveMaximum":
    case "multipleOf":
    case "minProperties":
    case "maxProperties":
    case "minItems":
    case "maxItems":
    case "uniqueItems":
    case "readOnly":
    case "writeOnly":
    case "style":
      return keyword
    default:
      return "unknown"
  }
}

function isMonospaceConstraint(labelKey: string): boolean {
  return labelKey === "pattern" || labelKey === "style" || labelKey === "unknown"
}

const CONSTRAINT_ORDER = [
  "minLength",
  "maxLength",
  "patternNoNull",
  "patternNoWhitespaceOptional",
  "patternNoWhitespace",
  "patternDigits",
  "patternIdentifier",
  "patternSlug",
  "pattern",
  "minimum",
  "exclusiveMinimum",
  "maximum",
  "exclusiveMaximum",
  "multipleOf",
  "minProperties",
  "maxProperties",
  "minItems",
  "maxItems",
  "uniqueItems",
  "readOnly",
  "writeOnly",
  "style",
  "unknown",
]

function getConstraintOrder(labelKey: string): number {
  const index = CONSTRAINT_ORDER.indexOf(labelKey)
  return index === -1 ? CONSTRAINT_ORDER.length : index
}

function getConstraints(node: RegularNode): JsonSchemaConstraintInfo[] {
  return Object.entries(node.validations).map(([keyword, value]) => {
    const labelKey = getConstraintLabelKey(keyword, value)
    const formattedValue = stringifyValue(value)
    return {
      keyword,
      value: formattedValue,
      labelKey,
      rawLabel: `${keyword}: ${formattedValue}`,
      monospace: isMonospaceConstraint(labelKey),
    }
  }).sort((a, b) => getConstraintOrder(a.labelKey) - getConstraintOrder(b.labelKey))
}

function toTreeNode(node: SchemaNode): JsonSchemaTreeNode {
  if (isBooleanishNode(node)) {
    return {
      id: node.id,
      name: getNodeName(node),
      path: getPath(node),
      typeLabel: node.fragment ? "true" : "false",
      typeInfo: {
        summary: node.fragment ? "true" : "false",
        format: "",
        combiner: "",
        variantCount: 0,
      },
      description: "",
      required: false,
      deprecated: false,
      enumValues: [],
      validations: [],
      constraints: [],
      defaultValue: "",
      children: [],
    }
  }

  if (isReferenceNode(node)) {
    return {
      id: node.id,
      name: getNodeName(node),
      path: getPath(node),
      typeLabel: node.value ? `$ref ${node.value}` : "$ref",
      typeInfo: {
        summary: node.value ? `$ref ${getSchemaRefName(normalizePointer(node.value)) || node.value}` : "$ref",
        format: "",
        combiner: "",
        variantCount: 0,
      },
      description: node.error || "",
      required: isRequired(node),
      deprecated: false,
      enumValues: [],
      validations: [],
      constraints: [],
      defaultValue: "",
      children: [],
    }
  }

  if (isRegularNode(node)) {
    const children = (node.children ?? []).map(toTreeNode)
    const constraints = getConstraints(node)
    return {
      id: node.id,
      name: getNodeName(node),
      path: getPath(node),
      typeLabel: getTypeLabel(node),
      typeInfo: getTypeInfo(node, children),
      description: getDescription(node),
      required: isRequired(node),
      deprecated: node.deprecated,
      enumValues: getEnumValues(node),
      validations: constraints.map(constraint => constraint.rawLabel),
      constraints,
      defaultValue: getDefaultValue(node),
      children,
    }
  }

  const children = node.children.map(toTreeNode)
  return {
    id: node.id,
    name: getNodeName(node),
    path: getPath(node),
    typeLabel: "schema",
    typeInfo: {
      summary: "schema",
      format: "",
      combiner: "",
      variantCount: 0,
    },
    description: "",
    required: false,
    deprecated: false,
    enumValues: [],
    validations: [],
    constraints: [],
    defaultValue: "",
    children,
  }
}

function normalizePointer(pointer: string): string {
  if (pointer.startsWith("#/")) return pointer
  if (pointer.startsWith("/")) return `#${pointer}`
  return pointer
}

export function buildJsonSchemaTree(
  schema: SchemaObject,
  schemaLookup: Map<string, SchemaObject>,
): JsonSchemaTreeNode[] {
  const resolveRef: SchemaTreeRefDereferenceFn = ref => {
    const refName = getSchemaRefName(normalizePointer(ref.pointer || ref.source || ""))
    return (refName ? schemaLookup.get(refName) : undefined) as SchemaFragment | undefined || {}
  }

  const tree = new SchemaTree(schema as SchemaFragment, {
    mergeAllOf: true,
    refResolver: resolveRef,
    maxRefDepth: 8,
  })
  tree.populate()

  return tree.root.children.map(toTreeNode)
}
