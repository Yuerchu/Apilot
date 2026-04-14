import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { SchemaObject, OpenAPISpec } from "@/lib/openapi/types"
import { resolveRef } from "@/lib/openapi/resolve-ref"
import { getTypeStr } from "@/lib/openapi/type-str"
import { formatSchema } from "@/lib/openapi/format-schema"
import { useProgressiveRender } from "@/hooks/use-progressive-render"
import { ModelCard } from "@/components/models/ModelCard"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewToolbar } from "@/components/layout/ViewToolbar"
import { toast } from "sonner"

interface ModelsViewProps {
  spec: OpenAPISpec
}

function formatModel(name: string, schema: SchemaObject, spec: OpenAPISpec): string {
  const resolved = resolveRef(schema, spec, new Set()) as SchemaObject
  const typeStr = getTypeStr(resolved)
  const desc = resolved.description || resolved.title || ""
  let out = `## ${name}\n`
  if (desc) out += `${desc}\n`
  out += `Type: ${typeStr}\n\n`
  out += `Schema:\n${formatSchema(resolved, 0, 15)}\n`
  return out
}

export function ModelsView({ spec }: ModelsViewProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState("")
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())

  const schemas = useMemo(() => {
    return spec.components?.schemas || spec.definitions || {}
  }, [spec])

  const sortedNames = useMemo(() => {
    return Object.keys(schemas).sort()
  }, [schemas])

  const filteredNames = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return sortedNames
    return sortedNames.filter(name => name.toLowerCase().includes(q))
  }, [sortedNames, filter])

  const { visible: visibleNames, isComplete } = useProgressiveRender(filteredNames, 30, 40)

  const handleSelectChange = useCallback((name: string, selected: boolean) => {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (selected) next.add(name)
      else next.delete(name)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedModels(new Set(sortedNames))
    } else {
      setSelectedModels(new Set())
    }
  }, [sortedNames])

  const handleCopySelected = useCallback(() => {
    if (selectedModels.size === 0) {
      toast.info(t("toast.selectModels"))
      return
    }
    const parts: string[] = []
    for (const name of selectedModels) {
      if (schemas[name]) {
        parts.push(formatModel(name, schemas[name], spec))
      }
    }
    const text = parts.join("\n---\n\n")
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t("toast.copiedModels", { count: selectedModels.size }))
    })
  }, [selectedModels, schemas, spec, t])

  const masterChecked = selectedModels.size === sortedNames.length && sortedNames.length > 0
  const masterIndeterminate = selectedModels.size > 0 && selectedModels.size < sortedNames.length

  return (
    <div className="space-y-3">
      <ViewToolbar
        selectAllChecked={masterIndeterminate ? "indeterminate" : masterChecked}
        onSelectAllChange={v => handleSelectAll(v === true)}
        searchPlaceholder={t("models.search")}
        filter={filter}
        onFilterChange={setFilter}
        totalCount={filteredNames.length}
        totalLabel={t("models.count", { count: filteredNames.length })}
        selectedCount={selectedModels.size}
        selectedLabel={t("models.selectedCount", { count: selectedModels.size })}
        onCopy={handleCopySelected}
      />

      {/* Model list */}
      <div className="space-y-2">
        {visibleNames.map(name => (
          <ModelCard
            key={name}
            name={name}
            schema={schemas[name]}
            spec={spec}
            selected={selectedModels.has(name)}
            onSelectChange={(sel) => handleSelectChange(name, sel)}
          />
        ))}
        {!isComplete && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}
        {filteredNames.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {filter ? t("models.noMatch") : t("models.noModels")}
          </div>
        )}
      </div>
    </div>
  )
}
