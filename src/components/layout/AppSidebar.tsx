import { useTranslation } from "react-i18next"
import {
  Route, Database, ExternalLink, Scale, Mail, GitCompare, Stethoscope, Star, Radio,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/animate-ui/components/radix/sidebar"
import { Badge } from "@/components/ui/badge"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useFavorites } from "@/hooks/use-favorites"
import type { MainView } from "@/lib/openapi/types"
import { APP_VERSION, GITHUB_URL, getBuildLabel } from "@/lib/app-info"
import { EnvironmentSwitcher } from "@/components/layout/EnvironmentSwitcher"

export function AppSidebar() {
  const { t } = useTranslation()
  const { state, setMainView } = useOpenAPIContext()
  const { state: asyncState } = useAsyncAPIContext()
  const { getSpecInfo, getSchemas } = useOpenAPI()
  const { favorites } = useFavorites()

  const info = getSpecInfo()
  const schemas = getSchemas()
  const specLoaded = !!state.spec
  const asyncSpecLoaded = !!asyncState.spec
  const isAsyncAPI = state.specType === "asyncapi"
  const hasSchemas = Object.keys(schemas).length > 0

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        {info ? (
          <div className="flex flex-col gap-1.5 px-3 py-3">
            <span className="text-sm font-semibold truncate">{info.title}</span>
            {info.summary && (
              <span className="text-[11px] text-muted-foreground leading-tight">{info.summary}</span>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{info.version}</Badge>
              <Badge variant="outline" className="text-[10px]">{info.specVersion}</Badge>
              {isAsyncAPI ? (
                <span className="text-[11px] text-muted-foreground">{t("sidebar.channelCount", { count: asyncState.channels.length })}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">{t("sidebar.endpointCount", { count: info.routeCount })}</span>
              )}
            </div>
            {info && (info.license || info.contact || info.termsOfService || info.externalDocs) && (
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
          <span className="text-sm font-semibold px-3 py-3">{t("app.title")}</span>
        )}
        {(specLoaded || asyncSpecLoaded) && <EnvironmentSwitcher />}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.nav")}</SidebarGroupLabel>
          <SidebarMenu>
            {asyncSpecLoaded && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={state.mainView === "channels"}
                  onClick={() => setMainView("channels" as MainView)}
                >
                  <Radio className="size-4" />
                  <span>{t("sidebar.channels")}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {asyncState.channels.length}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!isAsyncAPI && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={state.mainView === "endpoints"}
                  onClick={() => setMainView("endpoints" as MainView)}
                >
                  <Route className="size-4" />
                  <span>{t("sidebar.endpoints")}</span>
                  {specLoaded && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {state.routes.length}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {specLoaded && !isAsyncAPI && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={state.mainView === "favorites"}
                  onClick={() => setMainView("favorites" as MainView)}
                >
                  <Star className="size-4" />
                  <span>{t("sidebar.favorites")}</span>
                  {favorites.size > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {favorites.size}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={state.mainView === "models"}
                onClick={() => setMainView("models" as MainView)}
              >
                <Database className="size-4" />
                <span>{t("sidebar.models")}</span>
                {hasSchemas && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {Object.keys(schemas).length}
                  </Badge>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            {!isAsyncAPI && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={state.mainView === "diagnostics"}
                    onClick={() => setMainView("diagnostics" as MainView)}
                  >
                    <Stethoscope className="size-4" />
                    <span>{t("sidebar.diagnostics")}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={state.mainView === "diff"}
                    onClick={() => setMainView("diff" as MainView)}
                  >
                    <GitCompare className="size-4" />
                    <span>{t("sidebar.diff")}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-2">
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
