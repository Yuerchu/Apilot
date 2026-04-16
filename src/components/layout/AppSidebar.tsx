import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import i18n from "@/lib/i18n"
import {
  Settings, ChevronDown, Loader2, Upload,
  Route, Database, ExternalLink, Scale, Mail, Languages,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { toast } from "sonner"
import type { useAuth } from "@/hooks/use-auth"
import type { AuthType, MainView } from "@/lib/openapi/types"
import { APP_VERSION, GITHUB_URL, getBuildLabel } from "@/lib/app-info"

interface AppSidebarProps {
  auth: ReturnType<typeof useAuth>
}

export function AppSidebar({ auth }: AppSidebarProps) {
  const { t } = useTranslation()
  const { state, setBaseUrl, setMainView } = useOpenAPIContext()
  const { loadFromUrl, loadFromFile, loading, getServers, getOAuth2TokenUrl, getSpecInfo, getSchemas } = useOpenAPI()

  const servers = getServers()
  const info = getSpecInfo()
  const schemas = getSchemas()
  const specLoaded = !!state.spec
  const hasSchemas = Object.keys(schemas).length > 0

  const [url, setUrl] = useState(state.specUrl || "")
  const fileRef = useRef<HTMLInputElement>(null)

  const [oauth2User, setOAuth2User] = useState("")
  const [oauth2Pass, setOAuth2Pass] = useState("")
  const [oauth2TokenUrl, setOAuth2TokenUrl] = useState("")

  const detectedTokenUrl = getOAuth2TokenUrl()

  /* eslint-disable react-hooks/set-state-in-effect -- sync initial values from context/spec */
  useEffect(() => {
    const firstServer = servers[0]
    if (firstServer && !state.baseUrl) setBaseUrl(firstServer.url)
  }, [servers, state.baseUrl, setBaseUrl])

  useEffect(() => {
    if (detectedTokenUrl && !oauth2TokenUrl) setOAuth2TokenUrl(detectedTokenUrl)
  }, [detectedTokenUrl, oauth2TokenUrl])

  useEffect(() => {
    if (state.specUrl && !url) setUrl(state.specUrl)
  }, [state.specUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleLoad = () => {
    if (url.trim()) loadFromUrl(url.trim())
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFromFile(file)
    e.target.value = ""
  }

  const handleOAuth2Login = async () => {
    const result = await auth.oauth2Login(oauth2User, oauth2Pass, oauth2TokenUrl)
    if (result.success) toast.success(t("toast.oauth2Success"))
    else toast.error(result.error || t("toast.loginFailed"))
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        {info ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold truncate">{info.title}</span>
            {info.summary && (
              <span className="text-[11px] text-muted-foreground leading-tight">{info.summary}</span>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{info.version}</Badge>
              <Badge variant="outline" className="text-[10px]">OpenAPI {info.specVersion}</Badge>
              <span className="text-[11px] text-muted-foreground">{t("sidebar.endpointCount", { count: info.routeCount })}</span>
            </div>
            {(info.license || info.contact || info.termsOfService || info.externalDocs) && (
              <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                {info.license && (
                  <span className="flex items-center gap-1">
                    <Scale className="size-3 shrink-0" />
                    {info.license.url ? (
                      <a href={info.license.url} target="_blank" rel="noopener" className="hover:text-foreground transition-colors">{info.license.name || info.license.identifier || "License"}</a>
                    ) : (
                      <span>{info.license.name || info.license.identifier || "License"}</span>
                    )}
                  </span>
                )}
                {info.contact && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3 shrink-0" />
                    {info.contact.url ? (
                      <a href={info.contact.url} target="_blank" rel="noopener" className="hover:text-foreground transition-colors">{info.contact.name || info.contact.email || "Contact"}</a>
                    ) : info.contact.email ? (
                      <a href={`mailto:${info.contact.email}`} className="hover:text-foreground transition-colors">{info.contact.name || info.contact.email}</a>
                    ) : (
                      <span>{info.contact.name || "Contact"}</span>
                    )}
                  </span>
                )}
                {info.termsOfService && (
                  <a href={info.termsOfService} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <ExternalLink className="size-3 shrink-0" />
                    {t("sidebar.tos")}
                  </a>
                )}
                {info.externalDocs && (
                  <a href={info.externalDocs.url} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <ExternalLink className="size-3 shrink-0" />
                    {info.externalDocs.description || t("sidebar.externalDocs")}
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm font-semibold">{t("app.title")}</span>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Config: spec loader + server + auth */}
        <Collapsible defaultOpen>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md">
                <Settings className="size-3.5 mr-1.5" />
                {t("sidebar.config")}
                <ChevronDown className="size-3 ml-auto transition-transform group-data-[state=open]:rotate-180" />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="flex flex-col gap-3 px-2">
                {/* OpenAPI URL */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground font-medium">{t("sidebar.openapiUrl")}</label>
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLoad()}
                    placeholder={t("sidebar.openapiUrlPlaceholder")}
                    className="w-full text-xs"
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={handleLoad} disabled={loading} className="flex-1">
                      {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                      {t("sidebar.load")}
                    </Button>
                    <input ref={fileRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleFile} />
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="shrink-0">
                      <Upload className="size-3 mr-1" />
                      {t("sidebar.file")}
                    </Button>
                  </div>
                </div>

                {/* Server base URL (shown after spec loaded) */}
                {specLoaded && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-medium">{t("sidebar.server")}</label>
                    {servers.length > 1 ? (
                      <Select value={state.baseUrl} onValueChange={v => setBaseUrl(v)}>
                        <SelectTrigger className="w-full text-xs">
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
                        className="w-full text-xs"
                      />
                    )}
                  </div>
                )}

                {/* Auth */}
                {specLoaded && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-muted-foreground font-medium">{t("sidebar.auth")}</label>
                    <Select value={auth.authType} onValueChange={v => auth.setAuthType(v as AuthType)}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("sidebar.authNone")}</SelectItem>
                        <SelectItem value="bearer">{t("sidebar.authBearer")}</SelectItem>
                        <SelectItem value="basic">{t("sidebar.authBasic")}</SelectItem>
                        <SelectItem value="apikey">{t("sidebar.authApiKey")}</SelectItem>
                        <SelectItem value="oauth2">{t("sidebar.authOAuth2")}</SelectItem>
                      </SelectContent>
                    </Select>

                    {auth.authType === "bearer" && (
                      <Input type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="Token" className="text-xs" />
                    )}

                    {auth.authType === "basic" && (
                      <>
                        <Input value={auth.authUser} onChange={e => auth.setAuthUser(e.target.value)} placeholder="Username" className="text-xs" />
                        <Input type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="Password" className="text-xs" />
                      </>
                    )}

                    {auth.authType === "apikey" && (
                      <>
                        <Input value={auth.authKeyName} onChange={e => auth.setAuthKeyName(e.target.value)} placeholder="Header Name" className="text-xs" />
                        <Input type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="API Key" className="text-xs" />
                      </>
                    )}

                    {auth.authType === "oauth2" && (
                      <>
                        <Input value={oauth2User} onChange={e => setOAuth2User(e.target.value)} placeholder="Username" className="text-xs" />
                        <Input type="password" value={oauth2Pass} onChange={e => setOAuth2Pass(e.target.value)} placeholder="Password" className="text-xs" />
                        <Input value={oauth2TokenUrl} onChange={e => setOAuth2TokenUrl(e.target.value)} placeholder="Token URL" className="text-xs" />
                        <Button size="sm" onClick={handleOAuth2Login} disabled={auth.oauth2Loading} className="w-full">
                          {auth.oauth2Loading ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                          {t("sidebar.login")}
                        </Button>
                        {auth.oauth2Token && <span className="text-xs text-green-500">{t("sidebar.authenticated")}</span>}
                      </>
                    )}
                  </div>
                )}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Separator />

        {/* Navigation */}
        {specLoaded && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("sidebar.nav")}</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={state.mainView === "endpoints"}
                  onClick={() => setMainView("endpoints" as MainView)}
                >
                  <Route className="size-4" />
                  <span>{t("sidebar.endpoints")}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {state.routes.length}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {hasSchemas && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={state.mainView === "models"}
                    onClick={() => setMainView("models" as MainView)}
                  >
                    <Database className="size-4" />
                    <span>{t("sidebar.models")}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {Object.keys(schemas).length}
                    </Badge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-2 flex flex-col gap-1">
        <button
          type="button"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1"
          onClick={() => {
            const next = i18n.language === "zh" ? "en" : "zh"
            i18n.changeLanguage(next)
          }}
        >
          <Languages className="size-3.5" />
          {i18n.language === "zh" ? "English" : "中文"}
        </button>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span><strong>Apilot</strong> v{APP_VERSION} ({getBuildLabel()})</span>
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="hover:text-foreground transition-colors" title="GitHub">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
