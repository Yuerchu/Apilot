import { useTranslation } from "react-i18next"
import { Badge, badgeVariants } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { JsonSchemaTreeNode } from "@/lib/json-schema-tree"
import { cn } from "@/lib/utils"

interface JsonSchemaTreeViewProps {
  nodes: JsonSchemaTreeNode[]
  emptyText: string
  selectedNodeId?: string | null
  onSelectNode?: (node: JsonSchemaTreeNode) => void
  hasNodeDetails?: (node: JsonSchemaTreeNode) => boolean
}

interface FlatTreeNode {
  node: JsonSchemaTreeNode
  depth: number
}

const VISIBLE_ENUM_VALUE_COUNT = 4

function flattenTree(nodes: JsonSchemaTreeNode[], depth = 0): FlatTreeNode[] {
  return nodes.flatMap(node => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ])
}

function EnumOverflowBadge({ values }: { values: string[] }) {
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            badgeVariants({ variant: "outline" }),
            "cursor-help text-[10px]",
          )}
        >
          {t("schemaViewer.moreEnumValues", { count: values.length })}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-80 text-left">
        <div className="mb-1 font-medium">
          {t("schemaViewer.hiddenEnumValues")}
        </div>
        <div className="font-mono leading-relaxed [overflow-wrap:anywhere]">
          {values.join(", ")}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function NodeMeta({ node }: { node: JsonSchemaTreeNode }) {
  const { t } = useTranslation()
  const combiner = node.typeInfo.combiner
  const visibleEnumValues = node.enumValues.slice(0, VISIBLE_ENUM_VALUE_COUNT)
  const hiddenEnumValues = node.enumValues.slice(VISIBLE_ENUM_VALUE_COUNT)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="font-mono text-[10px]">
        {node.typeInfo.summary || node.typeLabel}
      </Badge>
      {node.typeInfo.format && (
        <Badge variant="outline" className="font-mono text-[10px]">
          {t("schemaViewer.formatValue", { value: node.typeInfo.format })}
        </Badge>
      )}
      {combiner && (
        <Badge variant="secondary" className="text-[10px]">
          {t(`schemaViewer.combiner.${combiner}` as const)}
        </Badge>
      )}
      {combiner && node.typeInfo.variantCount > 0 && (
        <Badge variant="outline" className="text-[10px]">
          {t("schemaViewer.variantCount", { count: node.typeInfo.variantCount })}
        </Badge>
      )}
      {node.required && (
        <Badge variant="destructive" className="h-4 px-1.5 py-0 text-[10px] font-normal">
          {t("schemaViewer.required")}
        </Badge>
      )}
      {node.deprecated && (
        <Badge variant="secondary" className="text-[10px]">
          {t("schemaViewer.deprecated")}
        </Badge>
      )}
      {node.defaultValue && (
        <Badge variant="outline" className="font-mono text-[10px]">
          {t("schemaViewer.defaultValue", { value: node.defaultValue })}
        </Badge>
      )}
      {visibleEnumValues.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1">
          {visibleEnumValues.map(value => (
            <Badge key={value} variant="secondary" className="font-mono text-[10px] font-normal">
              {value}
            </Badge>
          ))}
          {hiddenEnumValues.length > 0 && <EnumOverflowBadge values={hiddenEnumValues} />}
        </span>
      )}
    </div>
  )
}

function JsonSchemaTreeRow({
  node,
  depth,
  hasDetails,
  onSelect,
  selected,
}: FlatTreeNode & {
  hasDetails: boolean
  onSelect: ((node: JsonSchemaTreeNode) => void) | undefined
  selected: boolean
}) {
  const { t } = useTranslation()
  const selectable = Boolean(onSelect)
  const selectNode = () => onSelect?.(node)
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      tabIndex={selectable ? 0 : undefined}
      className={cn(selectable && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      onClick={selectNode}
      onKeyDown={event => {
        if (!selectable || (event.key !== "Enter" && event.key !== " ")) return
        event.preventDefault()
        selectNode()
      }}
    >
      <TableCell className="min-w-0 whitespace-normal align-top">
        <div
          className={cn(
            "min-w-0 font-mono font-medium",
            depth > 0 && "border-l pl-3",
          )}
          style={{ marginLeft: depth ? `${Math.min(depth, 6) * 0.75}rem` : undefined }}
        >
          <div className="truncate" title={node.name}>{node.name}</div>
          <div className="mt-1 truncate text-[10px] text-muted-foreground" title={node.path}>{node.path}</div>
        </div>
      </TableCell>
      <TableCell className="min-w-0 whitespace-normal align-top">
        <NodeMeta node={node} />
      </TableCell>
      <TableCell className="min-w-0 whitespace-normal align-top text-xs text-muted-foreground">
        {node.description && (
          <div className="[overflow-wrap:anywhere]">{node.description}</div>
        )}
        {hasDetails && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {t("schemaViewer.fieldHasDetails")}
          </div>
        )}
        {node.constraints.length > 0 && (
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            {node.constraints.map((constraint, index) => (
              <Badge
                key={`${constraint.keyword}:${constraint.value}:${index}`}
                variant="outline"
                className={cn("text-[10px]", constraint.monospace && "font-mono")}
                title={constraint.rawLabel}
              >
                {t(`schemaViewer.constraints.${constraint.labelKey}` as const, {
                  keyword: constraint.keyword,
                  value: constraint.value,
                })}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export function JsonSchemaTreeView({
  nodes,
  emptyText,
  hasNodeDetails,
  onSelectNode,
  selectedNodeId,
}: JsonSchemaTreeViewProps) {
  const { t } = useTranslation()
  const rows = flattenTree(nodes)

  if (nodes.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="min-w-0 rounded-md border">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[32%]" />
          <col className="w-[34%]" />
          <col className="w-[34%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>{t("schema.field")}</TableHead>
            <TableHead>{t("schemaViewer.schemaColumn")}</TableHead>
            <TableHead>{t("schema.description")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ node, depth }) => (
            <JsonSchemaTreeRow
              key={node.id}
              node={node}
              depth={depth}
              hasDetails={hasNodeDetails?.(node) ?? false}
              selected={selectedNodeId === node.id}
              onSelect={onSelectNode}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
