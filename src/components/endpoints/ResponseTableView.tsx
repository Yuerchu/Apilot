import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { SchemaObject } from "@/lib/openapi/types"
import { buildJsonSchemaTree, type JsonSchemaTreeNode } from "@/lib/json-schema-tree"
import { ResponseAgGrid, ResponseKeyValueGrid } from "./ResponseAgGrid"

interface ResponseTableViewProps {
  data: unknown
  schema?: SchemaObject | undefined
}

export interface FieldMeta {
  description: string
  type: string
  children: Map<string, FieldMeta>
}

function isCombinerVariant(name: string): boolean {
  return /^(anyOf|oneOf|allOf)\s*#\d+$/.test(name)
}

function unwrapCombiners(nodes: JsonSchemaTreeNode[]): JsonSchemaTreeNode[] {
  const result: JsonSchemaTreeNode[] = []
  for (const node of nodes) {
    const shouldUnwrap =
      (node.typeInfo.combiner && node.children.length > 0) ||
      (isCombinerVariant(node.name) && node.children.length > 0) ||
      (node.name === "schema" && node.children.length > 0)
    if (shouldUnwrap) {
      result.push(...unwrapCombiners(node.children))
    } else {
      result.push(node)
    }
  }
  return result
}

export function buildFieldMap(nodes: JsonSchemaTreeNode[]): Map<string, FieldMeta> {
  const map = new Map<string, FieldMeta>()
  const resolved = unwrapCombiners(nodes)
  for (const node of resolved) {
    let childMap = new Map<string, FieldMeta>()
    if (node.children.length > 0) {
      const itemsChild = node.children.find(c => c.name === "items")
      if (itemsChild && itemsChild.children.length > 0) {
        childMap = buildFieldMap(itemsChild.children)
      } else {
        childMap = buildFieldMap(node.children)
      }
    }
    map.set(node.name, {
      description: node.description,
      type: node.typeInfo.summary,
      children: childMap,
    })
  }
  return map
}

export function isObjectArray(arr: unknown[]): arr is Record<string, unknown>[] {
  return arr.length > 0 && arr.every(item => item !== null && typeof item === "object" && !Array.isArray(item))
}

export function collectColumns(items: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key)
        order.push(key)
      }
    }
  }
  return order
}

export function ResponseTableView({ data, schema }: ResponseTableViewProps) {
  const { t } = useTranslation()

  const fieldMap = useMemo(() => {
    if (!schema) return new Map<string, FieldMeta>()
    try {
      const nodes = buildJsonSchemaTree(schema, new Map())
      return buildFieldMap(nodes)
    } catch {
      return new Map<string, FieldMeta>()
    }
  }, [schema])

  if (data === null || data === undefined || typeof data !== "object") {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        {t("response.tableEmpty")}
      </div>
    )
  }

  if (Array.isArray(data)) {
    if (isObjectArray(data)) {
      return <ResponseAgGrid items={data} fieldMap={fieldMap} />
    }
    return (
      <div className="p-4 font-mono text-xs whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </div>
    )
  }

  return (
    <ResponseKeyValueGrid
      data={data as Record<string, unknown>}
      fieldMap={fieldMap}
    />
  )
}
