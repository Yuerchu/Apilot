import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { SearchIcon } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { CommandPalette } from "@/components/search/CommandPalette"
import { HeaderShareButton } from "@/components/share/ShareDialog"

export function Header() {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const info = state.spec?.info
  const [searchOpen, setSearchOpen] = useState(false)

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

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <SidebarTrigger className="shrink-0" />
        <Separator orientation="vertical" className="h-4" />
        {info ? (
          <span className="text-sm text-muted-foreground truncate">
            {info.title} {info.version ? `v${info.version}` : ""}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t("app.title")}</span>
        )}

        <div className="flex-1" />

        {(state.spec || state.specUrl || state.baseUrl) && <HeaderShareButton />}

        {state.spec && (
          <InputGroup className="max-w-xs cursor-pointer" onClick={() => setSearchOpen(true)}>
            <InputGroupAddon>
              <SearchIcon className="text-muted-foreground" />
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
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
