import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Copy } from "lucide-react"
import type { ParsedRoute } from "@/lib/openapi/types"
import { formatMarkdown } from "@/lib/format-route"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface SchemaTabProps {
  route: ParsedRoute
  index: number
}

export function SchemaTab({ route, index: _index }: SchemaTabProps) {
  const { t } = useTranslation()
  const schemaText = formatMarkdown(route)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(schemaText).then(() => {
      toast.success(t("toast.copied"))
    })
  }, [schemaText, t])

  return (
    <div className="space-y-3">
      <pre className="rounded-lg bg-muted/50 border p-4 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px] leading-relaxed">
        {schemaText}
      </pre>
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={handleCopy}>
          <Copy className="size-3.5" />
          {t("doc.copyRoute")}
        </Button>
      </div>
    </div>
  )
}
