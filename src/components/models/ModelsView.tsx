import { useState, useMemo, useCallback } from "react"
import { Search, Copy } from "lucide-react"
import type { SchemaObject, OpenAPISpec } from "@/lib/openapi/types"
import { resolveRef } from "@/lib/openapi/resolve-ref"
import { getTypeStr } from "@/lib/openapi/type-str"
import { formatSchema } from "@/lib/openapi/format-schema"
import { ModelCard } from "@/components/models/ModelCard"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
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
      toast.info("请先选择数据模型")
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
      toast.success(`已复制 ${selectedModels.size} 个数据模型`)
    })
  }, [selectedModels, schemas, spec])

  const masterChecked = selectedModels.size === sortedNames.length && sortedNames.length > 0
  const masterIndeterminate = selectedModels.size > 0 && selectedModels.size < sortedNames.length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={masterIndeterminate ? "indeterminate" : masterChecked}
            onCheckedChange={(v) => handleSelectAll(!!v)}
          />
          <span className="text-xs text-muted-foreground">全选</span>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="搜索模型..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filteredNames.length} 个模型
        </span>
        {selectedModels.size > 0 && (
          <span className="text-xs text-primary font-medium">
            已选 {selectedModels.size} 个
          </span>
        )}
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            selectedModels.size > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          disabled={selectedModels.size === 0}
          onClick={handleCopySelected}
        >
          <Copy className="size-3" />
          复制选中
        </button>
      </div>

      {/* Model list */}
      <div className="space-y-2">
        {filteredNames.map(name => (
          <ModelCard
            key={name}
            name={name}
            schema={schemas[name]}
            spec={spec}
            selected={selectedModels.has(name)}
            onSelectChange={(sel) => handleSelectChange(name, sel)}
          />
        ))}
        {filteredNames.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {filter ? "没有匹配的模型" : "没有数据模型"}
          </div>
        )}
      </div>
    </div>
  )
}
