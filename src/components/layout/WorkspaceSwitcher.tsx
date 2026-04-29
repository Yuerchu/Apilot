import { useTranslation } from "react-i18next"
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  FileWarning,
  Upload,
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/animate-ui/components/radix/sidebar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useSpecId } from "@/hooks/use-spec-id"
import { useSpecs } from "@/hooks/use-specs"
import { openSettings } from "@/components/settings/SettingsDialog"
import { cn } from "@/lib/utils"
import type { SpecRecord } from "@/lib/db"

function getSpecSubtitle(spec: SpecRecord): string {
  if (spec.sourceType === "url") return spec.specUrl || spec.origin
  if (spec.sourceType === "file") return spec.origin || spec.title
  return spec.origin || spec.sourceType
}

function formatSpecDate(timestamp: number): string {
  if (!timestamp) return ""
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const { state: asyncState } = useAsyncAPIContext()
  const currentSpecId = useSpecId()
  const { specs, loadSpec, loading: specsLoading } = useSpecs()

  const specLoaded = !!state.spec
  const currentSpec = specs.find(spec => spec.id === currentSpecId) ?? null
  const currentTitle = specLoaded
    ? state.spec?.info?.title || currentSpec?.title || t("app.title")
    : t("app.title")
  const CurrentIcon = specLoaded ? BookOpen : Upload
  const specVersion = state.specType === "asyncapi"
    ? asyncState.info?.specVersion ? `AsyncAPI ${asyncState.info.specVersion}` : "AsyncAPI"
    : state.spec?.openapi || state.spec?.swagger || ""
  const itemCount = state.specType === "asyncapi" ? asyncState.channels.length : state.routes.length

  const handleLoadSpec = async (spec: SpecRecord) => {
    if (spec.sourceType !== "url" || !spec.specUrl) return
    await loadSpec(spec.id)
  }

  const renderSpec = (spec: SpecRecord) => {
    const canLoad = spec.sourceType === "url" && !!spec.specUrl
    const Icon = canLoad ? BookOpen : FileWarning

    return (
      <DropdownMenuItem
        key={spec.id}
        className="items-start gap-2 p-2"
        disabled={!canLoad || specsLoading}
        onClick={() => handleLoadSpec(spec)}
      >
        <div className="mt-0.5 flex size-6 items-center justify-center rounded-sm border">
          <Icon className="size-4" />
        </div>
        <div className="grid flex-1 gap-0.5 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{spec.title}</span>
            {spec.version && (
              <Badge variant="outline" className="h-4 rounded-sm px-1 text-[10px]">
                {spec.version}
              </Badge>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {canLoad ? getSpecSubtitle(spec) : t("workspace.fileNeedsReload")}
          </span>
          {spec.lastOpenedAt > 0 && (
            <span className="truncate text-[11px] text-muted-foreground">
              {formatSpecDate(spec.lastOpenedAt)}
            </span>
          )}
        </div>
        <Check className={cn("mt-1 size-4", spec.id === currentSpecId ? "opacity-100" : "opacity-0")} />
      </DropdownMenuItem>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <CurrentIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{currentTitle}</span>
                {specLoaded && (
                  <span className="truncate text-xs text-muted-foreground">
                    {specVersion} · {state.specType === "asyncapi"
                      ? t("sidebar.channelCount", { count: itemCount })
                      : t("sidebar.endpointCount", { count: itemCount })}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("workspace.documents")}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {specs.length > 0 ? (
                specs.map(renderSpec)
              ) : (
                <DropdownMenuItem disabled className="p-2 text-xs text-muted-foreground">
                  {t("workspace.noDocuments")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={() => openSettings("connection")}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Upload className="size-4" />
              </div>
              <span className="text-sm">{t("workspace.loadDocument")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
