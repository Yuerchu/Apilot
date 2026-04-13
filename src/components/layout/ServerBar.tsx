import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"

export function ServerBar() {
  const { state, setBaseUrl } = useOpenAPIContext()
  const { getServers } = useOpenAPI()

  const servers = getServers()

  useEffect(() => {
    if (servers.length && !state.baseUrl) {
      setBaseUrl(servers[0].url)
    }
  }, [servers, state.baseUrl, setBaseUrl])

  const handleServerChange = (value: string) => {
    setBaseUrl(value)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
      <span className="text-sm font-medium text-muted-foreground shrink-0">Server:</span>
      {servers.length > 0 && (
        <Select value={state.baseUrl} onValueChange={handleServerChange}>
          <SelectTrigger className="w-auto max-w-[300px]" size="sm">
            <SelectValue placeholder="选择服务器" />
          </SelectTrigger>
          <SelectContent>
            {servers.map((s, i) => (
              <SelectItem key={i} value={s.url}>
                {s.description ? `${s.description} (${s.url})` : s.url}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input
        value={state.baseUrl}
        onChange={e => setBaseUrl(e.target.value)}
        placeholder="请填写服务端地址（如 http://localhost:8000）"
        className="max-w-[500px]"
      />
    </div>
  )
}
