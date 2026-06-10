import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleActionButton } from "../ConsoleActionButton"

export function ActionListTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div>
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
      </div>
      {resource.actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("console.noListEndpoint")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
          {resource.actions.map((action, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader className="flex-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                    {action.route.method.toUpperCase()}
                  </Badge>
                  <span className="truncate">{action.label}</span>
                </CardTitle>
                {action.route.summary && action.route.summary !== action.label && (
                  <CardDescription className="text-xs line-clamp-2">{action.route.summary}</CardDescription>
                )}
                <p className="text-[10px] text-muted-foreground font-mono truncate">{action.route.path}</p>
              </CardHeader>
              <div className="px-6 pb-4">
                <ConsoleActionButton action={action} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
