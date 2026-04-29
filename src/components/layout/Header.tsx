import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight } from "lucide-react"
import { Search as SearchIcon } from "@/components/animate-ui/icons/search"
import { Settings } from "@/components/animate-ui/icons/settings"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { SidebarTrigger, useSidebar } from "@/components/animate-ui/components/radix/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { CommandPalette } from "@/components/search/CommandPalette"
import { HeaderShareButton } from "@/components/share/ShareDialog"
import { SettingsDialog } from "@/components/settings/SettingsDialog"
import type { MainView } from "@/lib/openapi/types"

const VIEW_I18N: Record<string, string> = {
  endpoints: "sidebar.endpoints",
  favorites: "sidebar.favorites",
  models: "sidebar.models",
  channels: "sidebar.channels",
  diagnostics: "sidebar.diagnostics",
  diff: "sidebar.diff",
  tools: "sidebar.tools",
}

export function Header() {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const sidebar = useSidebar()
  const info = state.spec?.info
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      setSearchOpen(true)
    }
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const viewKey = VIEW_I18N[state.mainView as MainView]
  const isCollapsed = sidebar.state === "collapsed"

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <SidebarTrigger className="shrink-0" />
        <Separator orientation="vertical" className="h-4" />

        {/* Breadcrumb: show title only when sidebar is collapsed */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground truncate">
          {isCollapsed && info && (
            <>
              <span className="truncate max-w-48">{info.title}</span>
              <ChevronRight className="size-3 shrink-0" />
            </>
          )}
          {viewKey && (
            <span className="text-foreground font-medium">{t(viewKey)}</span>
          )}
          {!viewKey && !isCollapsed && (
            <span>{info ? `${info.title}` : t("app.title")}</span>
          )}
        </nav>

        <div className="flex-1" />

        {(state.spec || state.specUrl || state.baseUrl) && <HeaderShareButton />}

        {state.spec && (
          <InputGroup className="max-w-xs cursor-pointer" onClick={() => setSearchOpen(true)}>
            <InputGroupAddon>
              <SearchIcon size={16} className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("search.placeholder")}
              readOnly
              className="cursor-pointer"
            />
            <InputGroupAddon align="inline-end">
              <Kbd>⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
        )}

        <AnimateIcon animateOnHover>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title={t("settings.title")}
            asChild
          >
            <span><Settings size={16} /></span>
          </Button>
        </AnimateIcon>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
