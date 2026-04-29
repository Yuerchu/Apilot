import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Upload, Pencil, Server, Plus, KeyRound } from "lucide-react"
import { Trash2 } from "@/components/animate-ui/icons/trash-2"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useEnvironments } from "@/hooks/use-environments"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { EnvironmentStage } from "@/lib/db"

const STAGE_PRIORITY: Record<string, number> = {
  local: 0,
  development: 1,
  testing: 2,
  staging: 3,
  production: 4,
  "": 5,
}

export function ConnectionSettings() {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const { loadFromUrl, loadFromFile, loading } = useOpenAPI()
  const { environments, activeEnvId, switchEnvironment, addEnvironment, updateEnvironment, removeEnvironment } = useEnvironments()

  const specLoaded = !!state.spec

  const [urlEdited, setUrlEdited] = useState(false)
  const [url, setUrl] = useState(state.specUrl || "")
  const fileRef = useRef<HTMLInputElement>(null)

  // Spec fetch auth
  const [showFetchAuth, setShowFetchAuth] = useState(false)
  const [fetchUser, setFetchUser] = useState("")
  const [fetchPass, setFetchPass] = useState("")

  // Show specUrl from context if user hasn't manually edited
  const displayUrl = urlEdited ? url : (state.specUrl || url)
  const handleUrlChange = (v: string) => {
    setUrlEdited(true)
    setUrl(v)
  }

  // Inline add form
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [newStage, setNewStage] = useState<EnvironmentStage>("")
  const [newSpecPath, setNewSpecPath] = useState("")

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [editStage, setEditStage] = useState<EnvironmentStage>("")
  const [editSpecPath, setEditSpecPath] = useState("")

  const handleLoad = () => {
    if (!displayUrl.trim()) return
    if (showFetchAuth && fetchUser) {
      loadFromUrl(displayUrl.trim(), { fetchAuth: { username: fetchUser, password: fetchPass } })
    } else {
      loadFromUrl(displayUrl.trim())
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFromFile(file)
    e.target.value = ""
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return
    await addEnvironment(newName.trim(), newUrl.trim(), newStage, newSpecPath.trim())
    setNewName("")
    setNewUrl("")
    setNewStage("")
    setNewSpecPath("")
    setAddOpen(false)
  }

  const startEdit = (env: typeof environments[0]) => {
    setEditId(env.id)
    setEditName(env.name)
    setEditUrl(env.baseUrl)
    setEditStage(env.stage)
    setEditSpecPath(env.specPath)
  }

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return
    await updateEnvironment(editId, { name: editName.trim(), baseUrl: editUrl.trim(), stage: editStage, specPath: editSpecPath.trim() })
    setEditId(null)
  }

  const STAGE_OPTIONS: { value: EnvironmentStage; labelKey: string }[] = [
    { value: "", labelKey: "environments.stagePlaceholder" },
    { value: "local", labelKey: "environments.stageLocal" },
    { value: "development", labelKey: "environments.stageDevelopment" },
    { value: "testing", labelKey: "environments.stageTesting" },
    { value: "staging", labelKey: "environments.stageStaging" },
    { value: "production", labelKey: "environments.stageProduction" },
  ]

  return (
    <div className="space-y-6">
      {/* OpenAPI URL */}
      <Field>
        <FieldLabel htmlFor="openapi-url">{t("sidebar.openapiUrl")}</FieldLabel>
        <Input
          id="openapi-url"
          value={displayUrl}
          onChange={e => handleUrlChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLoad()}
          placeholder={t("sidebar.openapiUrlPlaceholder")}
        />
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowFetchAuth(!showFetchAuth)}
        >
          <KeyRound className="size-3" />
          {t("connection.specAuth")}
        </button>

        {showFetchAuth && (
          <div className="flex gap-2">
            <Input
              value={fetchUser}
              onChange={e => setFetchUser(e.target.value)}
              placeholder={t("connection.specAuthUser")}
              className="h-8 text-xs flex-1"
            />
            <Input
              type="password"
              value={fetchPass}
              onChange={e => setFetchPass(e.target.value)}
              placeholder={t("connection.specAuthPass")}
              className="h-8 text-xs flex-1"
              onKeyDown={e => e.key === "Enter" && handleLoad()}
            />
          </div>
        )}

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
      </Field>

      {/* Environment Management */}
      {specLoaded && environments.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FieldLabel>{t("environments.title")}</FieldLabel>
              <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" />
                {t("environments.addNew")}
              </Button>
            </div>

            <div className="space-y-1.5">
              {[...environments].sort((a, b) => (STAGE_PRIORITY[a.stage] ?? 5) - (STAGE_PRIORITY[b.stage] ?? 5)).map(env => (
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
                      <Select value={editStage || "_none"} onValueChange={v => setEditStage((v === "_none" ? "" : v) as EnvironmentStage)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("environments.stagePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value || "_none"} value={opt.value || "_none"}>
                              {t(opt.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={editSpecPath}
                        onChange={e => setEditSpecPath(e.target.value)}
                        placeholder={t("environments.specPathPlaceholder")}
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
                          {env.stage && (
                            <Badge variant="secondary" className="text-[9px] shrink-0">{t(`environments.stage${env.stage.charAt(0).toUpperCase() + env.stage.slice(1)}`)}</Badge>
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
                            <Trash2 size={12} animateOnHover />
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
                />
                <Select value={newStage || "_none"} onValueChange={v => setNewStage((v === "_none" ? "" : v) as EnvironmentStage)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("environments.stagePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value || "_none"} value={opt.value || "_none"}>
                        {t(opt.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={newSpecPath}
                  onChange={e => setNewSpecPath(e.target.value)}
                  placeholder={t("environments.specPathPlaceholder")}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setAddOpen(false); setNewName(""); setNewUrl(""); setNewStage(""); setNewSpecPath("") }}>
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
