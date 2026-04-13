import { useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"

export function Header() {
  const { state } = useOpenAPIContext()
  const { loadFromUrl, loadFromFile, loading } = useOpenAPI()
  const [url, setUrl] = useState(state.specUrl || "")
  const fileRef = useRef<HTMLInputElement>(null)

  const handleLoad = () => {
    if (url.trim()) loadFromUrl(url.trim())
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFromFile(file)
    e.target.value = ""
  }

  return (
    <div className="flex items-center gap-2 p-3 border-b border-border">
      <Input
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleLoad()}
        placeholder="输入 OpenAPI JSON URL（如 http://localhost:8000/openapi.json）"
        className="flex-1"
      />
      <Button onClick={handleLoad} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        加载
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.yaml,.yml"
        className="hidden"
        onChange={handleFile}
      />
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <Upload className="size-4" />
        本地文件
      </Button>
    </div>
  )
}
