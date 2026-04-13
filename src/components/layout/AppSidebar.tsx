import { useState, useEffect, useRef } from "react"
import {
  Settings, ChevronDown, Loader2, Upload,
  Route, Database,
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

interface AppSidebarProps {
  auth: ReturnType<typeof useAuth>
}

export function AppSidebar({ auth }: AppSidebarProps) {
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

  useEffect(() => {
    if (servers.length && !state.baseUrl) setBaseUrl(servers[0].url)
  }, [servers, state.baseUrl, setBaseUrl])

  useEffect(() => {
    if (detectedTokenUrl && !oauth2TokenUrl) setOAuth2TokenUrl(detectedTokenUrl)
  }, [detectedTokenUrl, oauth2TokenUrl])

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

  const handleOAuth2Login = async () => {
    const result = await auth.oauth2Login(oauth2User, oauth2Pass, oauth2TokenUrl)
    if (result.success) toast.success("OAuth2 登录成功")
    else toast.error(result.error || "登录失败")
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        {info ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold truncate">{info.title}</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">{info.version}</Badge>
              <Badge variant="outline" className="text-[10px]">OpenAPI {info.specVersion}</Badge>
              <span className="text-[11px] text-muted-foreground">{info.routeCount} 个端点</span>
            </div>
          </div>
        ) : (
          <span className="text-sm font-semibold">OpenAPI Advance</span>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Config: spec loader + server + auth */}
        <Collapsible defaultOpen>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md">
                <Settings className="size-3.5 mr-1.5" />
                配置
                <ChevronDown className="size-3 ml-auto transition-transform group-data-[state=open]:rotate-180" />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="flex flex-col gap-3 px-2">
                {/* OpenAPI URL */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground font-medium">OpenAPI 地址</label>
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLoad()}
                    placeholder="OpenAPI JSON URL"
                    className="w-full text-xs"
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={handleLoad} disabled={loading} className="flex-1">
                      {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                      加载
                    </Button>
                    <input ref={fileRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleFile} />
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="shrink-0">
                      <Upload className="size-3 mr-1" />
                      文件
                    </Button>
                  </div>
                </div>

                {/* Server base URL (shown after spec loaded) */}
                {specLoaded && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-medium">服务器地址</label>
                    {servers.length > 1 ? (
                      <Select value={state.baseUrl} onValueChange={v => setBaseUrl(v)}>
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder="选择服务器" />
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
                        placeholder="http://localhost:8000"
                        className="w-full text-xs"
                      />
                    )}
                  </div>
                )}

                {/* Auth */}
                {specLoaded && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-muted-foreground font-medium">认证方式</label>
                    <Select value={auth.authType} onValueChange={v => auth.setAuthType(v as AuthType)}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无认证</SelectItem>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="apikey">API Key</SelectItem>
                        <SelectItem value="oauth2">OAuth2 Password</SelectItem>
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
                          登录
                        </Button>
                        {auth.oauth2Token && <span className="text-xs text-green-500">已认证</span>}
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
            <SidebarGroupLabel>导航</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={state.mainView === "endpoints"}
                  onClick={() => setMainView("endpoints" as MainView)}
                >
                  <Route className="size-4" />
                  <span>API 端点</span>
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
                    <span>数据模型</span>
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

      <SidebarFooter />
    </Sidebar>
  )
}
