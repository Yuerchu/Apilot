import { useTranslation } from "react-i18next"
import {
  Route, Database, GitCompare, Stethoscope, Star, Radio, Table2, ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/animate-ui/components/radix/sidebar"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { ConsoleImportExport } from "@/components/console/ConsoleImportExport"
import { useFavorites } from "@/hooks/use-favorites"
import type { MainView } from "@/lib/openapi/types"
import { APP_VERSION, GITHUB_URL, getBuildLabel } from "@/lib/app-info"
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher"
import { EnvironmentSwitcher } from "@/components/layout/EnvironmentSwitcher"
import { isHideTryIt } from "@/lib/embedded"

export function AppSidebar() {
  const { t } = useTranslation()
  const { state, setMainView } = useOpenAPIContext()
  const { state: asyncState } = useAsyncAPIContext()
  const { favorites } = useFavorites()
  const { state: consoleState, dispatch: consoleDispatch, groups } = useConsoleContext()

  const schemas = state.spec?.components?.schemas || state.spec?.definitions || {}
  const specLoaded = !!state.spec
  const asyncSpecLoaded = !!asyncState.spec
  const isAsyncAPI = state.specType === "asyncapi"
  const hasSchemas = Object.keys(schemas).length > 0
  const hasConsoleResources = groups.some(g => g.resources.length > 0)

  const handleConsoleResource = (basePath: string) => {
    setMainView("console" as MainView)
    consoleDispatch({ type: "SET_ACTIVE_RESOURCE", key: basePath })
  }

  const handleConsoleAction = (basePath: string, actionIndex: number) => {
    setMainView("console" as MainView)
    consoleDispatch({ type: "SET_ACTIVE_ACTION", key: basePath, actionIndex })
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <WorkspaceSwitcher />
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

        {specLoaded && !isAsyncAPI && hasConsoleResources && !isHideTryIt() && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("sidebar.console")}
              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">Beta</Badge>
              <ConsoleImportExport />
            </SidebarGroupLabel>
            <SidebarMenu>
              {groups.map(group => (
                <Collapsible key={group.label} asChild defaultOpen={false} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={group.label}>
                        <Table2 className="size-4" />
                        <span className="truncate">{group.label}</span>
                        <Badge variant="secondary" className="ml-auto text-[9px] mr-1">
                          {group.resources.length}
                        </Badge>
                        <ChevronRight className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {group.resources.map(resource => (
                          <SidebarMenuSubItem key={resource.basePath}>
                            <SidebarMenuSubButton
                              isActive={state.mainView === "console" && consoleState.activeResourceKey === resource.basePath && consoleState.activeActionIndex === null}
                              onClick={() => handleConsoleResource(resource.basePath)}
                            >
                              <span className="truncate">{resource.displayName}</span>
                            </SidebarMenuSubButton>
                            {resource.actions.length > 0 && resource.actions.map((action, ai) => (
                              <SidebarMenuSubButton
                                key={ai}
                                isActive={state.mainView === "console" && consoleState.activeResourceKey === resource.basePath && consoleState.activeActionIndex === ai}
                                onClick={() => handleConsoleAction(resource.basePath, ai)}
                                className="pl-4"
                              >
                                <span className="truncate text-[11px]">{action.label}</span>
                              </SidebarMenuSubButton>
                            ))}
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {specLoaded && <EnvironmentSwitcher />}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-3 py-2">
          <span><strong>Apilot</strong> v{APP_VERSION} ({getBuildLabel()})</span>
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="hover:text-foreground transition-colors" title="GitHub">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
