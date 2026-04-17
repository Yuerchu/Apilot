import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Upload } from "lucide-react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ConnectionSettings() {
  const { t } = useTranslation()
  const { state, setBaseUrl } = useOpenAPIContext()
  const { loadFromUrl, loadFromFile, loading, getServers } = useOpenAPI()

  const servers = getServers()
  const specLoaded = !!state.spec

  const [url, setUrl] = useState(state.specUrl || "")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.specUrl && !url) setUrl(state.specUrl)
  }, [state.specUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const firstServer = servers[0]
    if (firstServer && !state.baseUrl) setBaseUrl(firstServer.url)
  }, [servers, state.baseUrl, setBaseUrl])

  const handleLoad = () => {
    if (url.trim()) loadFromUrl(url.trim())
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFromFile(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t("sidebar.openapiUrl")}</Label>
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLoad()}
          placeholder={t("sidebar.openapiUrlPlaceholder")}
        />
        <div className="flex gap-2">
          <Button onClick={handleLoad} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("sidebar.load")}
          </Button>
          <input ref={fileRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="shrink-0">
            <Upload className="size-4" />
            {t("sidebar.file")}
          </Button>
        </div>
      </div>

      {specLoaded && (
        <div className="space-y-2">
          <Label>{t("sidebar.server")}</Label>
          {servers.length > 1 ? (
            <Select value={state.baseUrl} onValueChange={v => setBaseUrl(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("sidebar.selectServer")} />
              </SelectTrigger>
              <SelectContent>
                {servers.map((s, i) => (
                  <SelectItem key={i} value={s.url}>
                    {s.description || s.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={state.baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder={t("sidebar.serverPlaceholder")}
            />
          )}
        </div>
      )}
    </div>
  )
}
