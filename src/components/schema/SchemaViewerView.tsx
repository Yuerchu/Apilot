import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { ArrowLeft, ChevronDown, ChevronUp, Database, FileJson, Loader2, Search, Upload } from "lucide-react"
import { Empty as ShadcnEmpty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { OpenAPISpec, SchemaViewerSource } from "@/lib/openapi/types"
import {
  buildSchemaFieldExtensions,
  createSchemaLookup,
  getOpenAPISchemaViewerItems,
  parseSchemaViewerDocument,
  type SchemaConstraintClause,
  type SchemaFieldDynamicRule,
  type SchemaFieldExtension,
  type SchemaFileAcceptRule,
  type SchemaFileConstraint,
  type SchemaViewerItem,
} from "@/lib/schema-viewer"
import {
  buildJsonSchemaTree,
  type JsonSchemaConstraintInfo,
  type JsonSchemaTreeNode,
} from "@/lib/json-schema-tree"
import { getErrorMessage } from "@/lib/openapi/parser"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Markdown } from "@/components/ui/markdown"
import { JsonSchemaTreeView } from "@/components/schema/JsonSchemaTreeView"
import { cn } from "@/lib/utils"

interface SchemaViewerViewProps {
  spec?: OpenAPISpec | undefined
}

interface SchemaFacetOption {
  value: string
  count: number
}

type SchemaFieldMobilePane = "schema" | "field"
type SchemaViewerMobilePane = "list" | "detail"

const ALL_SCHEMA_FILTER_VALUE = "__all__"
const COLLAPSED_DESCRIPTION_HEIGHT = "max-h-[4.75rem]"

function shouldCollapseDescription(description: string): boolean {
  const normalized = description.trim()
  if (normalized.length > 160) return true
  return normalized.split(/\r?\n/).filter(line => line.trim()).length > 2
}

function buildFacetOptions(
  items: SchemaViewerItem[],
  getValue: (item: SchemaViewerItem) => string,
): SchemaFacetOption[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const value = getValue(item).trim()
    if (!value) continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))
}

function filterItems(
  items: SchemaViewerItem[],
  filter: string,
  categoryFilter: string,
  typeFilter: string,
): SchemaViewerItem[] {
  const q = filter.trim().toLowerCase()
  return items.filter(item => {
    if (categoryFilter && item.category !== categoryFilter) return false
    if (typeFilter && item.responseType !== typeFilter) return false
    if (!q) return true
    const haystack = [
      item.name,
      item.description,
      item.category,
      item.responseType,
      item.endpoint,
    ].join(" ").toLowerCase()
    return haystack.includes(q)
  })
}

function SourceButton({
  active,
  count,
  icon,
  label,
  onClick,
}: {
  active: boolean
  count: number
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
    >
      {icon}
      {label}
      <Badge variant="outline" className="text-[10px]">
        {count.toLocaleString()}
      </Badge>
    </Button>
  )
}

function SchemaListItem({
  item,
  active,
  onClick,
}: {
  item: SchemaViewerItem
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full min-w-0 border-b border-border/50 px-3 py-2 text-left transition-colors hover:bg-muted/40",
        active && "bg-muted/60",
      )}
      onClick={onClick}
    >
      <div className="min-w-0 truncate font-mono text-sm font-semibold">
        {item.name}
      </div>
      {(item.endpoint || item.responseType || item.category) && (
        <div className="mt-1 flex min-w-0 flex-wrap gap-1">
          {item.responseType && <Badge variant="secondary" className="text-[10px]">{item.responseType}</Badge>}
          {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
          {item.endpoint && (
            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
              {item.endpoint}
            </span>
          )}
        </div>
      )}
      {item.description && (
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {item.description}
        </div>
      )}
    </button>
  )
}

function EmptyState({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <ShadcnEmpty className="min-h-[240px]">
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{children}</EmptyTitle>
      </EmptyHeader>
    </ShadcnEmpty>
  )
}

function formatValue(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function flattenSchemaNodes(nodes: JsonSchemaTreeNode[]): JsonSchemaTreeNode[] {
  return nodes.flatMap(node => [node, ...flattenSchemaNodes(node.children)])
}

const FILE_LIMIT_ORDER = [
  "max_size",
  "min_size",
  "min_width",
  "max_width",
  "min_height",
  "max_height",
  "aspect_ratio_min",
  "aspect_ratio_max",
]

const FILE_LIMIT_LABEL_KEYS: Record<string, string> = {
  max_size: "maxSize",
  min_size: "minSize",
  min_width: "minWidth",
  max_width: "maxWidth",
  min_height: "minHeight",
  max_height: "maxHeight",
  aspect_ratio_min: "aspectRatioMin",
  aspect_ratio_max: "aspectRatioMax",
}

function formatFileSize(value: number): string {
  const units = ["B", "KB", "MB", "GB"]
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  const digits = amount >= 10 || Number.isInteger(amount) ? 0 : 1
  return `${amount.toFixed(digits)} ${units[unitIndex]}`
}

function formatFileLimitLabel(key: string, t: TFunction): string {
  const labelKey = FILE_LIMIT_LABEL_KEYS[key]
  if (labelKey) return t(`schemaViewer.fileLimits.${labelKey}`)
  return key.replace(/_/g, " ")
}

function formatFileLimitValue(key: string, value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (key.includes("size")) return formatFileSize(value)
    if (key.includes("width") || key.includes("height")) return `${value.toLocaleString()} px`
    return value.toLocaleString()
  }
  return formatValue(value)
}

function getSortedLimitEntries(limits: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(limits).sort(([left], [right]) => {
    const leftIndex = FILE_LIMIT_ORDER.indexOf(left)
    const rightIndex = FILE_LIMIT_ORDER.indexOf(right)
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? FILE_LIMIT_ORDER.length : leftIndex)
        - (rightIndex === -1 ? FILE_LIMIT_ORDER.length : rightIndex)
    }
    return left.localeCompare(right)
  })
}

function limitsMatch(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatFileAcceptRule(rule: SchemaFileAcceptRule, t: TFunction): string {
  const limits = getSortedLimitEntries(rule.limits)
  if (limits.length === 0) return rule.mimeType
  const details = limits
    .map(([key, value]) => `${formatFileLimitLabel(key, t)} ${formatFileLimitValue(key, value)}`)
    .join(", ")
  return `${rule.mimeType}: ${details}`
}

function formatConstraintText(constraint: JsonSchemaConstraintInfo, t: TFunction): string {
  return t(`schemaViewer.constraints.${constraint.labelKey}`, {
    keyword: constraint.keyword,
    value: constraint.value,
  })
}

function formatClauseText(clause: SchemaConstraintClause, t: TFunction): string {
  const value = formatValue(clause.value)
  if (clause.operator === "has_items") {
    return t(clause.value
      ? "schemaViewer.operators.hasItemsTrue"
      : "schemaViewer.operators.hasItemsFalse", { field: clause.field })
  }
  if (clause.operator === "visible") {
    return t(clause.value
      ? "schemaViewer.operators.visibleTrue"
      : "schemaViewer.operators.visibleFalse", { field: clause.field })
  }
  if (clause.operator === "required") {
    return t(clause.value
      ? "schemaViewer.operators.requiredTrue"
      : "schemaViewer.operators.requiredFalse", { field: clause.field })
  }
  if (clause.operator === "eq") {
    return t("schemaViewer.operators.eq", { field: clause.field, value })
  }
  if (clause.operator === "max_items") {
    return t("schemaViewer.operators.maxItems", { field: clause.field, value })
  }
  if (clause.operator === "min_items") {
    return t("schemaViewer.operators.minItems", { field: clause.field, value })
  }
  return t("schemaViewer.operators.fallback", {
    field: clause.field,
    operator: clause.operator,
    value,
  })
}

function getDynamicRuleRoleLabel(rule: SchemaFieldDynamicRule, t: TFunction): string {
  if (rule.role === "condition") return t("schemaViewer.fieldRuleAsCondition")
  if (rule.role === "action") return t("schemaViewer.fieldRuleAsAction")
  return t("schemaViewer.fieldRuleAsBoth")
}

function getRawExtensionPaths(extension: SchemaFieldExtension | null): string[] {
  if (!extension) return []
  const paths = new Set<string>()
  if (extension.fileConstraint) {
    paths.add(`file_constraints.constraints.${extension.field}`)
  }
  for (const rule of extension.dynamicRules) {
    paths.add(`x_constraints[${rule.index}]`)
  }
  return [...paths]
}

function DetailSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="min-w-0 rounded-md border bg-background/50 px-3 py-2">
        {children}
      </div>
    </section>
  )
}

function DetailRow({
  label,
  value,
  monospace,
}: {
  label: string
  value: ReactNode
  monospace?: boolean
}) {
  return (
    <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-1 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("min-w-0 [overflow-wrap:anywhere]", monospace && "font-mono")}>
        {value}
      </div>
    </div>
  )
}

function FieldInspector({
  className,
  extension,
  node,
}: {
  className?: string
  extension: SchemaFieldExtension | null
  node: JsonSchemaTreeNode
}) {
  const { t } = useTranslation()
  const fileConstraint = extension?.fileConstraint ?? null
  const dynamicRules = extension?.dynamicRules ?? []
  const rawPaths = getRawExtensionPaths(extension)
  const commonFileLimits = fileConstraint?.accepts.length
    && fileConstraint.accepts.every(rule => limitsMatch(rule.limits, fileConstraint.accepts[0]!.limits))
    ? getSortedLimitEntries(fileConstraint.accepts[0]!.limits)
    : []
  const hasFileSpecificLimits = Boolean(fileConstraint?.accepts.some(rule => (
    Object.keys(rule.limits).length > 0
  ))) && commonFileLimits.length === 0

  return (
    <aside className={cn("flex min-w-0 flex-col gap-3 rounded-md border bg-muted/20 p-3", className)}>
      <div className="min-w-0">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{t("schemaViewer.fieldDetails")}</div>
          <div className="mt-1 truncate font-mono text-sm font-semibold" title={node.name}>
            {node.name}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={node.path}>
            {node.path}
          </div>
        </div>
      </div>

      <DetailSection title={t("schemaViewer.jsonSchemaDetails")}>
        <dl>
          <DetailRow label={t("schemaViewer.fieldType")} value={node.typeInfo.summary || node.typeLabel} monospace />
          <DetailRow label={t("schemaViewer.fieldRequired")} value={node.required ? t("schemaViewer.yes") : t("schemaViewer.no")} />
          {node.defaultValue && (
            <DetailRow label={t("schemaViewer.fieldDefault")} value={node.defaultValue} monospace />
          )}
          {node.enumValues.length > 0 && (
            <DetailRow label={t("schemaViewer.fieldEnum")} value={node.enumValues.join(", ")} monospace />
          )}
          {node.constraints.length > 0 && (
            <DetailRow
              label={t("schemaViewer.fieldConstraints")}
              value={(
                <div className="flex min-w-0 flex-col gap-1">
                  {node.constraints.map((constraint, index) => (
                    <div key={`${constraint.keyword}:${constraint.value}:${index}`}>
                      {formatConstraintText(constraint, t)}
                    </div>
                  ))}
                </div>
              )}
            />
          )}
        </dl>
      </DetailSection>

      {fileConstraint && (
        <DetailSection title={t("schemaViewer.fileInputDetails")}>
          <dl>
            {fileConstraint.role && (
              <DetailRow label={t("schemaViewer.fieldRole")} value={fileConstraint.role} />
            )}
            {fileConstraint.maxCount !== null && (
              <DetailRow label={t("schemaViewer.fieldMaxCount")} value={fileConstraint.maxCount.toLocaleString()} />
            )}
            {fileConstraint.maxTotalSize !== null && (
              <DetailRow label={t("schemaViewer.fieldMaxTotalSize")} value={formatFileSize(fileConstraint.maxTotalSize)} />
            )}
            {fileConstraint.accepts.length > 0 && (
              <DetailRow
                label={t("schemaViewer.fieldAcceptedTypes")}
                value={fileConstraint.accepts.map(rule => rule.mimeType).join(", ")}
                monospace
              />
            )}
            {commonFileLimits.length > 0 && (
              <DetailRow
                label={t("schemaViewer.fieldLimits")}
                value={(
                  <div className="flex min-w-0 flex-col gap-1">
                    {commonFileLimits.map(([key, value]) => (
                      <div key={key}>
                        {formatFileLimitLabel(key, t)}: {formatFileLimitValue(key, value)}
                      </div>
                    ))}
                  </div>
                )}
              />
            )}
            {hasFileSpecificLimits && fileConstraint.accepts.length > 0 && (
              <DetailRow
                label={t("schemaViewer.fieldLimits")}
                value={(
                  <div className="flex min-w-0 flex-col gap-1">
                    {fileConstraint.accepts.map(rule => (
                      <div key={rule.mimeType}>{formatFileAcceptRule(rule, t)}</div>
                    ))}
                  </div>
                )}
              />
            )}
          </dl>
        </DetailSection>
      )}

      {dynamicRules.length > 0 && (
        <DetailSection title={t("schemaViewer.dynamicRuleDetails")}>
          <div className="flex min-w-0 flex-col gap-3">
            {dynamicRules.map(rule => (
              <div key={`${rule.index}:${rule.role}`} className="flex min-w-0 flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="text-[10px] text-muted-foreground">
                  {getDynamicRuleRoleLabel(rule, t)} · x_constraints[{rule.index}]
                </div>
                <div className="flex min-w-0 flex-col gap-1 text-xs">
                  <div className="font-medium">{t("schemaViewer.fieldRuleWhen")}</div>
                  {rule.conditions.map((clause, index) => (
                    <div key={`${clause.field}:${clause.operator}:${index}`} className="text-muted-foreground">
                      {formatClauseText(clause, t)}
                    </div>
                  ))}
                </div>
                <div className="flex min-w-0 flex-col gap-1 text-xs">
                  <div className="font-medium">{t("schemaViewer.fieldRuleThen")}</div>
                  {rule.actions.map((clause, index) => (
                    <div key={`${clause.field}:${clause.operator}:${index}`} className="text-muted-foreground">
                      {formatClauseText(clause, t)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {rawPaths.length > 0 ? (
        <DetailSection title={t("schemaViewer.rawExtensionDetails")}>
          <div className="flex min-w-0 flex-col gap-1 font-mono text-[10px] text-muted-foreground">
            {rawPaths.map(path => <div key={path}>{path}</div>)}
          </div>
        </DetailSection>
      ) : (
        <div className="text-xs text-muted-foreground">
          {t("schemaViewer.noFieldExtensions")}
        </div>
      )}
    </aside>
  )
}

function ConstraintClauseBadge({ clause }: { clause: SchemaConstraintClause }) {
  return (
    <Badge variant="outline" className="font-mono text-[10px]">
      {clause.field} {clause.operator} {formatValue(clause.value)}
    </Badge>
  )
}

function FileConstraintRow({ rule }: { rule: SchemaFileConstraint }) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0 rounded-md border px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="font-mono text-sm font-medium">{rule.field}</span>
        {rule.role && <Badge variant="secondary" className="text-[10px]">{rule.role}</Badge>}
        {rule.maxCount !== null && <Badge variant="outline" className="text-[10px]">{t("schemaViewer.maxCount", { count: rule.maxCount })}</Badge>}
        {rule.maxTotalSize !== null && (
          <Badge variant="outline" className="text-[10px]">{t("schemaViewer.maxTotalSize", { size: rule.maxTotalSize })}</Badge>
        )}
      </div>
      {rule.accepts.length > 0 && (
        <div className="mt-2 flex min-w-0 flex-wrap gap-1">
          {rule.accepts.slice(0, 12).map(accept => (
            <Badge key={accept.mimeType} variant="outline" className="font-mono text-[10px]">
              {accept.mimeType}
            </Badge>
          ))}
          {rule.accepts.length > 12 && (
            <Badge variant="outline" className="text-[10px]">
              +{rule.accepts.length - 12}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

function SchemaRuleSections({ item }: { item: SchemaViewerItem }) {
  const { t } = useTranslation()
  const hasRules = item.standardRules.length > 0 || item.crossFieldRules.length > 0 || item.fileConstraints.length > 0
  if (!hasRules) return null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {item.standardRules.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2">
          <div className="text-sm font-semibold">{t("schemaViewer.standardRules")}</div>
          <div className="flex min-w-0 flex-col gap-2">
            {item.standardRules.map((rule, index) => (
              <div key={`${rule.keyword}:${rule.path}:${index}`} className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-md border px-3 py-2">
                <Badge variant="secondary" className="font-mono text-[10px]">{rule.keyword}</Badge>
                <Badge variant="outline" className="font-mono text-[10px]">{rule.path}</Badge>
                <span className="min-w-0 truncate text-xs text-muted-foreground">{rule.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {item.crossFieldRules.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2">
          <div className="text-sm font-semibold">{t("schemaViewer.crossFieldRules")}</div>
          <div className="flex min-w-0 flex-col gap-2">
            {item.crossFieldRules.map((rule, index) => (
              <div key={index} className="flex min-w-0 flex-col gap-2 rounded-md border px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{t("schemaViewer.when")}</Badge>
                  {rule.conditions.map((clause, clauseIndex) => (
                    <ConstraintClauseBadge key={`${clause.field}:${clause.operator}:${clauseIndex}`} clause={clause} />
                  ))}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{t("schemaViewer.then")}</Badge>
                  {rule.actions.map((clause, clauseIndex) => (
                    <ConstraintClauseBadge key={`${clause.field}:${clause.operator}:${clauseIndex}`} clause={clause} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {item.fileConstraints.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2">
          <div className="text-sm font-semibold">{t("schemaViewer.fileRules")}</div>
          <div className="flex min-w-0 flex-col gap-2">
            {item.fileConstraints.map(rule => (
              <FileConstraintRow key={rule.field} rule={rule} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SchemaTreeScrollPane({
  emptyText,
  fieldExtensions,
  nodes,
  onSelectNode,
  selectedNodeId,
}: {
  emptyText: string
  fieldExtensions: Map<string, SchemaFieldExtension>
  nodes: JsonSchemaTreeNode[]
  onSelectNode: (node: JsonSchemaTreeNode) => void
  selectedNodeId: string | null
}) {
  return (
    <div className="min-h-0 overflow-auto">
      <JsonSchemaTreeView
        nodes={nodes}
        emptyText={emptyText}
        selectedNodeId={selectedNodeId}
        hasNodeDetails={node => fieldExtensions.has(node.name)}
        onSelectNode={onSelectNode}
      />
    </div>
  )
}

export function SchemaViewerView({ spec }: SchemaViewerViewProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const {
    state,
    setActiveSchemaName,
    setSchemaCategoryFilter,
    setSchemaFilter,
    setSchemaSource,
    setSchemaTypeFilter,
  } = useOpenAPIContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [externalItems, setExternalItems] = useState<SchemaViewerItem[]>([])
  const [externalFileName, setExternalFileName] = useState("")
  const [externalError, setExternalError] = useState<string | null>(null)
  const [loadingExternal, setLoadingExternal] = useState(false)
  const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(null)
  const [selectedFieldNodeId, setSelectedFieldNodeId] = useState<string | null>(null)
  const [schemaMobilePane, setSchemaMobilePane] = useState<SchemaFieldMobilePane>("schema")
  const [schemaViewerMobilePane, setSchemaViewerMobilePane] = useState<SchemaViewerMobilePane>("list")

  const openAPIItems = useMemo(() => spec ? getOpenAPISchemaViewerItems(spec) : [], [spec])
  const activeItems = state.schemaSource === "external" ? externalItems : openAPIItems
  const categoryOptions = useMemo(
    () => buildFacetOptions(activeItems, item => item.category),
    [activeItems],
  )
  const typeOptions = useMemo(
    () => buildFacetOptions(activeItems, item => item.responseType),
    [activeItems],
  )
  const filteredItems = useMemo(
    () => filterItems(
      activeItems,
      state.schemaFilter,
      state.schemaCategoryFilter,
      state.schemaTypeFilter,
    ),
    [activeItems, state.schemaCategoryFilter, state.schemaFilter, state.schemaTypeFilter],
  )
  const selectedItem = filteredItems.find(item => item.id === state.activeSchemaName)
    || filteredItems[0]
    || null
  const schemaLookup = useMemo(() => createSchemaLookup(activeItems), [activeItems])
  const selectedTreeResult = useMemo(() => {
    if (!selectedItem) return { nodes: [], error: "" }
    try {
      return {
        nodes: buildJsonSchemaTree(selectedItem.schema, schemaLookup),
        error: "",
      }
    } catch (error) {
      return {
        nodes: [],
        error: getErrorMessage(error),
      }
    }
  }, [schemaLookup, selectedItem])
  const fieldExtensions = useMemo(
    () => selectedItem ? buildSchemaFieldExtensions(selectedItem) : new Map<string, SchemaFieldExtension>(),
    [selectedItem],
  )
  const flatSchemaNodes = useMemo(
    () => flattenSchemaNodes(selectedTreeResult.nodes),
    [selectedTreeResult.nodes],
  )
  const selectedFieldNode = flatSchemaNodes.find(node => node.id === selectedFieldNodeId) || null
  const selectedFieldExtension = selectedFieldNode
    ? fieldExtensions.get(selectedFieldNode.name) ?? null
    : null
  const descriptionExpanded = selectedItem ? expandedDescriptionId === selectedItem.id : false
  const descriptionCollapsible = selectedItem?.description
    ? shouldCollapseDescription(selectedItem.description)
    : false
  const activeSchemaListId = isMobile ? state.activeSchemaName : selectedItem?.id ?? ""

  useEffect(() => {
    setSelectedFieldNodeId(null)
  }, [selectedItem?.id])

  useEffect(() => {
    if (!selectedFieldNode) {
      setSchemaMobilePane("schema")
    }
  }, [selectedFieldNode])

  useEffect(() => {
    if (!selectedItem) {
      setSchemaViewerMobilePane("list")
    }
  }, [selectedItem])

  const selectSource = (source: SchemaViewerSource) => {
    setSchemaSource(source)
    const nextItems = source === "external" ? externalItems : openAPIItems
    setActiveSchemaName(nextItems[0]?.id || "")
    setSchemaViewerMobilePane("list")
  }

  const updateSchemaSearch = (value: string) => {
    setSchemaFilter(value)
    setActiveSchemaName("")
    setSchemaViewerMobilePane("list")
  }

  const updateCategoryFilter = (value: string) => {
    setSchemaCategoryFilter(value === ALL_SCHEMA_FILTER_VALUE ? "" : value)
    setActiveSchemaName("")
    setSchemaViewerMobilePane("list")
  }

  const updateTypeFilter = (value: string) => {
    setSchemaTypeFilter(value === ALL_SCHEMA_FILTER_VALUE ? "" : value)
    setActiveSchemaName("")
    setSchemaViewerMobilePane("list")
  }

  const selectSchemaItem = (schemaId: string) => {
    setActiveSchemaName(schemaId)
    setSchemaViewerMobilePane("detail")
  }

  const selectFieldNode = (node: JsonSchemaTreeNode, showMobileDetails = false) => {
    const nextId = selectedFieldNodeId === node.id ? null : node.id
    setSelectedFieldNodeId(nextId)
    if (showMobileDetails) {
      setSchemaMobilePane(nextId ? "field" : "schema")
    }
  }

  const showSchemaList = () => {
    setActiveSchemaName("")
    setSelectedFieldNodeId(null)
    setSchemaMobilePane("schema")
    setSchemaViewerMobilePane("list")
  }

  const showFieldList = () => {
    setSelectedFieldNodeId(null)
    setSchemaMobilePane("schema")
  }

  const loadExternalFile = async (file: File | undefined) => {
    if (!file) return
    setLoadingExternal(true)
    setExternalError(null)
    try {
      const text = await file.text()
      const items = parseSchemaViewerDocument(text, file.name)
      if (items.length === 0) {
        throw new Error(t("schemaViewer.noReadableSchemas"))
      }
      setExternalItems(items)
      setExternalFileName(file.name)
      setSchemaSource("external")
      setActiveSchemaName(items[0]?.id || "")
      setSchemaFilter("")
      setSchemaViewerMobilePane("list")
    } catch (error) {
      setExternalError(getErrorMessage(error))
    } finally {
      setLoadingExternal(false)
    }
  }

  const schemaListCard = (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
      <CardContent className="px-3 py-3">
        <Input
          value={state.schemaFilter}
          onChange={event => updateSchemaSearch(event.target.value)}
          placeholder={t("schemaViewer.search")}
          className="text-sm"
        />
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
          <Select
            value={state.schemaCategoryFilter || ALL_SCHEMA_FILTER_VALUE}
            onValueChange={updateCategoryFilter}
          >
            <SelectTrigger size="sm" className="w-full min-w-0">
              <SelectValue placeholder={t("schemaViewer.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_SCHEMA_FILTER_VALUE}>
                  {t("schemaViewer.allCategories")}
                </SelectItem>
                {categoryOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value} ({option.count})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={state.schemaTypeFilter || ALL_SCHEMA_FILTER_VALUE}
            onValueChange={updateTypeFilter}
          >
            <SelectTrigger size="sm" className="w-full min-w-0">
              <SelectValue placeholder={t("schemaViewer.allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_SCHEMA_FILTER_VALUE}>
                  {t("schemaViewer.allTypes")}
                </SelectItem>
                {typeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value} ({option.count})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {t("schemaViewer.visibleCount", {
            count: filteredItems.length,
            total: activeItems.length,
          })}
        </div>
      </CardContent>
      <Separator />

      <div className="min-h-0 flex-1 overflow-auto">
        {activeItems.length === 0 ? (
          <EmptyState icon={state.schemaSource === "external" ? <Upload /> : <FileJson />}>
            {state.schemaSource === "external"
              ? t("schemaViewer.uploadHint")
              : t("schemaViewer.noSchemas")}
          </EmptyState>
        ) : filteredItems.length === 0 ? (
          <EmptyState icon={<Search />}>
            {t("schemaViewer.noMatch")}
          </EmptyState>
        ) : (
          filteredItems.map(item => (
            <SchemaListItem
              key={item.id}
              item={item}
              active={activeSchemaListId === item.id}
              onClick={() => selectSchemaItem(item.id)}
            />
          ))
        )}
      </div>
    </Card>
  )

  const schemaDetailCard = (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
      {selectedItem ? (
        <>
          <CardHeader className="gap-2 px-3 py-3">
            {isMobile && (
              <div className="col-span-full flex w-full justify-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={showSchemaList}
                >
                  <ArrowLeft data-icon="inline-start" />
                  {t("schemaViewer.backToSchemaList")}
                </Button>
              </div>
            )}
            <CardTitle className="min-w-0 truncate font-mono text-sm">
              {selectedItem.name}
            </CardTitle>
            {(selectedItem.endpoint || selectedItem.responseType || selectedItem.category) && (
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {selectedItem.responseType && <Badge variant="secondary">{selectedItem.responseType}</Badge>}
                {selectedItem.category && <Badge variant="outline">{selectedItem.category}</Badge>}
                {selectedItem.endpoint && (
                  <Badge variant="outline" className="min-w-0 max-w-full truncate font-mono">
                    {selectedItem.endpoint}
                  </Badge>
                )}
              </div>
            )}
            {selectedItem.description && (
              <Collapsible
                open={descriptionExpanded}
                onOpenChange={(open) => setExpandedDescriptionId(open ? selectedItem.id : null)}
                className="flex min-w-0 flex-col gap-1"
              >
                <CollapsibleContent
                  forceMount
                  className={cn(
                    "relative min-w-0",
                    descriptionCollapsible && !descriptionExpanded && `${COLLAPSED_DESCRIPTION_HEIGHT} overflow-hidden`,
                  )}
                >
                  <Markdown className="text-sm text-muted-foreground [&>p]:my-0 [&_li]:my-0 [&_ol]:my-1 [&_p]:leading-relaxed [&_ul]:my-1">
                    {selectedItem.description}
                  </Markdown>
                  {descriptionCollapsible && !descriptionExpanded && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-card" />
                  )}
                </CollapsibleContent>
                {descriptionCollapsible && (
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 self-start px-2 text-xs text-muted-foreground"
                    >
                      {descriptionExpanded
                        ? t("schemaViewer.collapseDescription")
                        : t("schemaViewer.expandDescription")}
                      {descriptionExpanded ? (
                        <ChevronUp data-icon="inline-end" aria-hidden="true" />
                      ) : (
                        <ChevronDown data-icon="inline-end" aria-hidden="true" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                )}
              </Collapsible>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3">
            {selectedTreeResult.error ? (
              <EmptyState>{selectedTreeResult.error}</EmptyState>
            ) : selectedFieldNode ? (
              isMobile ? (
                schemaMobilePane === "field" ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 self-start px-2 text-xs"
                      onClick={showFieldList}
                    >
                      <ArrowLeft data-icon="inline-start" />
                      {t("schemaViewer.backToFieldList")}
                    </Button>
                    <div className="min-h-0 overflow-auto">
                      <FieldInspector
                        node={selectedFieldNode}
                        extension={selectedFieldExtension}
                      />
                    </div>
                  </div>
                ) : (
                  <SchemaTreeScrollPane
                    nodes={selectedTreeResult.nodes}
                    emptyText={t("schemaViewer.emptySchema")}
                    selectedNodeId={selectedFieldNode.id}
                    fieldExtensions={fieldExtensions}
                    onSelectNode={node => selectFieldNode(node, true)}
                  />
                )
              ) : (
                <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                  <SchemaTreeScrollPane
                    nodes={selectedTreeResult.nodes}
                    emptyText={t("schemaViewer.emptySchema")}
                    selectedNodeId={selectedFieldNode.id}
                    fieldExtensions={fieldExtensions}
                    onSelectNode={node => selectFieldNode(node)}
                  />
                  <div className="min-h-0 overflow-auto">
                    <FieldInspector
                      node={selectedFieldNode}
                      extension={selectedFieldExtension}
                    />
                  </div>
                </div>
              )
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
                <JsonSchemaTreeView
                  nodes={selectedTreeResult.nodes}
                  emptyText={t("schemaViewer.emptySchema")}
                  selectedNodeId={null}
                  hasNodeDetails={node => fieldExtensions.has(node.name)}
                  onSelectNode={node => selectFieldNode(node, isMobile)}
                />
                <SchemaRuleSections item={selectedItem} />
              </div>
            )}
          </CardContent>
        </>
      ) : (
        <CardContent className="px-3 py-3">
          <EmptyState icon={state.schemaSource === "external" ? <Upload /> : <FileJson />}>
            {state.schemaSource === "external"
              ? t("schemaViewer.uploadHint")
              : t("schemaViewer.noSchemas")}
          </EmptyState>
        </CardContent>
      )}
    </Card>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
      <Card className="gap-0 py-0">
        <CardHeader className="grid-rows-1 items-center gap-3 px-3 py-3">
          <div className="min-w-0">
            <CardTitle className="text-sm">{t("schemaViewer.title")}</CardTitle>
            <CardDescription className="mt-1 truncate text-xs">
              {state.schemaSource === "external"
                ? externalFileName || t("schemaViewer.externalSource")
                : t("schemaViewer.openapiSource")}
            </CardDescription>
          </div>
          <CardAction className="row-span-1 self-center flex flex-wrap items-center gap-2">
            <SourceButton
              active={state.schemaSource === "openapi"}
              count={openAPIItems.length}
              icon={<Database data-icon="inline-start" />}
              label={t("schemaViewer.openapiSource")}
              onClick={() => selectSource("openapi")}
            />
            <SourceButton
              active={state.schemaSource === "external"}
              count={externalItems.length}
              icon={<FileJson data-icon="inline-start" />}
              label={t("schemaViewer.externalSource")}
              onClick={() => selectSource("external")}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              className="hidden"
              onChange={event => {
                void loadExternalFile(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loadingExternal}
              onClick={() => fileInputRef.current?.click()}
            >
              {loadingExternal ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              {t("schemaViewer.upload")}
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      {externalError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {externalError}
        </div>
      )}

      {isMobile ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          {schemaViewerMobilePane === "detail" ? schemaDetailCard : schemaListCard}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
          {schemaListCard}
          {schemaDetailCard}
        </div>
      )}
    </div>
  )
}
