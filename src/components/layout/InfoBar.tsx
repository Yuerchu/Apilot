import { Badge } from "@/components/ui/badge"
import { useOpenAPI } from "@/hooks/use-openapi"

export function InfoBar() {
  const { getSpecInfo } = useOpenAPI()
  const info = getSpecInfo()

  if (!info) return null

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-sm">
      <span className="font-medium">{info.title}</span>
      {info.version && (
        <Badge variant="secondary">{info.version}</Badge>
      )}
      <Badge variant="outline">OpenAPI {info.specVersion}</Badge>
      <span className="text-muted-foreground">{info.routeCount} 个端点</span>
    </div>
  )
}
