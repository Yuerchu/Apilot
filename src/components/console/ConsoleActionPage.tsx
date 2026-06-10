import { useTranslation } from "react-i18next"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleActionButton } from "./ConsoleActionButton"

export function ConsoleActionPage({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold truncate">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono truncate">{resource.basePath}</p>
      </div>
      <div className="flex flex-col gap-2 max-w-md">
        {resource.actions.map((action, i) => (
          <ConsoleActionButton key={i} action={action} />
        ))}
        {resource.actions.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("console.noListEndpoint")}</p>
        )}
      </div>
    </div>
  )
}
