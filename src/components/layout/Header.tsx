import { useTranslation } from "react-i18next"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"

export function Header() {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const info = state.spec?.info

  return (
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
    </div>
  )
}
