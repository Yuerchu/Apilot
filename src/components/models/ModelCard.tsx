import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, Copy, Route } from "lucide-react"
import type { SchemaObject, OpenAPISpec, MainView } from "@/lib/openapi/types"
import { resolveRef } from "@/lib/openapi/resolve-ref"
import { getTypeStr } from "@/lib/openapi/type-str"
import { formatSchema } from "@/lib/openapi/format-schema"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { SchemaTree } from "@/components/schema/SchemaTree"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ModelCardProps {
  name: string
  schema: SchemaObject
  spec: OpenAPISpec
  selected: boolean
  onSelectChange: (selected: boolean) => void
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

export function ModelCard({ name, schema, spec, selected, onSelectChange }: ModelCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [built, setBuilt] = useState(false)
  const [resolved, setResolved] = useState<SchemaObject | null>(null)

  const typeStr = getTypeStr(schema)
  const desc = schema.description || schema.title || ""

  const handleToggle = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && !built) {
      const r = resolveRef(schema, spec, new Set()) as SchemaObject
      setResolved(r)
      setBuilt(true)
    }
  }, [schema, spec, built])

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const text = formatModel(name, schema, spec)
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t("toast.copied"))
    })
  }, [name, schema, spec, t])

  return (
    <Collapsible open={open} onOpenChange={handleToggle}>
      <div
        className={cn(
          "rounded-lg border bg-card transition-colors",
          selected && "border-primary/50 bg-primary/5",
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onSelectChange(!!v)}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            />
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-90",
              )}
            />
            <span className="font-mono text-sm font-medium truncate">{name}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0 max-w-[200px] truncate" title={typeStr}>
              {typeStr}
            </Badge>
            {desc && (
              <span className="text-xs text-muted-foreground truncate ml-1">{desc}</span>
            )}
            <div className="ml-auto shrink-0">
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={handleCopy}
              >
                <Copy className="size-3" />
                {t("endpoints.copy")}
              </button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            {resolved && <SchemaTree schema={resolved} />}
            <UsedByEndpoints modelName={name} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function UsedByEndpoints({ modelName }: { modelName: string }) {
  const { t } = useTranslation()
  const { state, setMainView } = useOpenAPIContext()
  const routeIndices = state.modelRouteMap.modelToRoutes[modelName]
  if (!routeIndices?.length) return null

  const methodColors: Record<string, string> = {
    get: "text-method-get",
    post: "text-method-post",
    put: "text-method-put",
    patch: "text-method-patch",
    delete: "text-method-delete",
  }

  return (
    <div>
      <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <Route className="size-3" />
        {t("models.usedBy", { count: routeIndices.length })}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {routeIndices.map(idx => {
          const r = state.routes[idx]
          if (!r) return null
          return (
            <Badge
              key={idx}
              variant="outline"
              className="cursor-pointer hover:bg-accent text-xs gap-1"
              onClick={() => setMainView("endpoints" as MainView)}
              title={`${r.method.toUpperCase()} ${r.path}`}
            >
              <span className={methodColors[r.method] || "text-muted-foreground"}>
                {r.method.toUpperCase()}
              </span>
              <span className="font-mono">{r.path}</span>
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
