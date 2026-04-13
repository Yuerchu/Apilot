import { useCallback } from "react"
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
  const schemaText = formatMarkdown(route)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(schemaText).then(() => {
      toast.success("已复制到剪贴板")
    })
  }, [schemaText])

  return (
    <div className="space-y-3">
      <pre className="rounded-lg bg-muted/50 border p-4 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px] leading-relaxed">
        {schemaText}
      </pre>
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={handleCopy}>
          <Copy className="size-3.5" />
          复制此路由
        </Button>
      </div>
    </div>
  )
}
