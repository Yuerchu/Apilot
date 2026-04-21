import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Upload, Trash2, Pencil, Server, Plus } from "lucide-react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useEnvironments } from "@/hooks/use-environments"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export function ConnectionSettings() {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const { loadFromUrl, loadFromFile, loading } = useOpenAPI()
  const { environments, activeEnvId, switchEnvironment, addEnvironment, updateEnvironment, removeEnvironment } = useEnvironments()

  const specLoaded = !!state.spec

  const [url, setUrl] = useState(state.specUrl || "")
  const fileRef = useRef<HTMLInputElement>(null)

  // Inline add form
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editUrl, setEditUrl] = useState("")

  useEffect(() => {
    if (state.specUrl && !url) setUrl(state.specUrl)
  }, [state.specUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = () => {
    if (url.trim()) loadFromUrl(url.trim())
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFromFile(file)
    e.target.value = ""
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return
    await addEnvironment(newName.trim(), newUrl.trim())
    setNewName("")
    setNewUrl("")
    setAddOpen(false)
  }

  const startEdit = (env: typeof environments[0]) => {
    setEditId(env.id)
    setEditName(env.name)
    setEditUrl(env.baseUrl)
  }

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return
    await updateEnvironment(editId, { name: editName.trim(), baseUrl: editUrl.trim() })
    setEditId(null)
  }

  return (
    <div className="space-y-6">
      {/* OpenAPI URL */}
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

      {/* Environment Management */}
      {specLoaded && environments.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("environments.title")}</Label>
              <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" />
                {t("environments.addNew")}
              </Button>
            </div>

            <div className="space-y-1.5">
              {environments.map(env => (
                <div key={env.id}>
                  {editId === env.id ? (
                    <div className="rounded-lg border bg-card p-3 space-y-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder={t("environments.name")}
                      />
                      <Input
                        value={editUrl}
                        onChange={e => setEditUrl(e.target.value)}
                        placeholder="https://api.example.com"
                        disabled={env.source === "spec"}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                          {t("storage.cancel")}
                        </Button>
                        <Button size="sm" onClick={saveEdit}>
                          {t("environments.save")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                        env.id === activeEnvId ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-accent/30"
                      }`}
                      onClick={() => switchEnvironment(env.id)}
                    >
                      <Server className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{env.name}</span>
                          {env.source === "spec" && (
                            <Badge variant="outline" className="text-[9px] shrink-0">{t("environments.fromSpec")}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">{env.baseUrl}</span>
                      </div>
                      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => startEdit(env)}>
                          <Pencil className="size-3" />
                        </Button>
                        {environments.length > 1 && (
                          <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeEnvironment(env.id)}>
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Inline add form */}
            {addOpen && (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={t("environments.namePlaceholder")}
                />
                <Input
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setAddOpen(false); setNewName(""); setNewUrl("") }}>
                    {t("storage.cancel")}
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || !newUrl.trim()}>
                    {t("environments.add")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
