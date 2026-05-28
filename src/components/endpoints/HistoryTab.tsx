import { memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Trash2, History } from "lucide-react"
import { formatDistanceToNow, type Locale } from "date-fns"
import { zhCN, zhTW, ja, ko, enUS } from "date-fns/locale"
import i18n from "@/lib/i18n"
import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"
import { getParsedRouteKey } from "@/lib/openapi/route-key"
import { useHistory } from "@/hooks/use-history"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { Braces, TableProperties } from "lucide-react"
import { CodeViewer } from "@/components/editor/CodeViewer"
import { ResponseTableView } from "./ResponseTableView"
import {
  Collapsible,
  CollapsibleTrigger,
  AnimatedCollapsibleContent,
} from "@/components/ui/collapsible"

const DATE_LOCALES: Record<string, Locale> = {
  zh_CN: zhCN,
  zh_HK: zhTW,
  zh_TW: zhTW,
  en: enUS,
  ja,
  ko,
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "bg-method-get/20 text-method-get border-method-get/30"
  if (status >= 300 && status < 400) return "bg-method-redirect/20 text-method-redirect border-method-redirect/30"
  if (status >= 400 && status < 500) return "bg-method-patch/20 text-method-patch border-method-patch/30"
  return "bg-method-delete/20 text-method-delete border-method-delete/30"
}

function JsonOrTable({ body, schema, maxHeight }: { body: string; schema?: SchemaObject | undefined; maxHeight: string }) {
  const { t } = useTranslation()
  const [view, setView] = useState<"table" | "json">("table")
  const parsed = useMemo(() => {
    try { return JSON.parse(body) } catch { return null }
  }, [body])
  const isJson = parsed !== null && typeof parsed === "object"

  if (!isJson) {
    return <CodeViewer code={body} language="shell" maxHeight={maxHeight} />
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-3 py-1 border-b bg-muted/20">
        <Button
          variant={view === "table" ? "secondary" : "ghost"}
          size="xs"
          onClick={() => setView("table")}
        >
          <TableProperties className="size-3" />
          {t("response.tableView")}
        </Button>
        <Button
          variant={view === "json" ? "secondary" : "ghost"}
          size="xs"
          onClick={() => setView("json")}
        >
          <Braces className="size-3" />
          JSON
        </Button>
      </div>
      {view === "table" ? (
        <ResponseTableView data={parsed} schema={schema} />
      ) : (
        <CodeViewer code={body} language="json" maxHeight={maxHeight} />
      )}
    </div>
  )
}

interface HistoryTabProps {
  route: ParsedRoute
}

function getResponseSchema(route: ParsedRoute, status: number): SchemaObject | undefined {
  const statusKey = String(status)
  const respDef = route.responses[statusKey] || route.responses["default"]
  if (!respDef?.content) return undefined
  const mediaType = Object.values(respDef.content)[0]
  return mediaType?.schema as SchemaObject | undefined
}

function getRequestBodySchema(route: ParsedRoute): SchemaObject | undefined {
  if (!route.requestBody?.content) return undefined
  const mediaType = Object.values(route.requestBody.content)[0]
  return mediaType?.schema as SchemaObject | undefined
}

export const HistoryTab = memo(function HistoryTab({ route }: HistoryTabProps) {
  const { t } = useTranslation()
  const routeKey = getParsedRouteKey(route)
  const { entries, clearEntries, envFilter, setEnvFilter } = useHistory(routeKey)
  const locale = DATE_LOCALES[i18n.language] ?? enUS
  const requestBodySchema = useMemo(() => getRequestBodySchema(route), [route])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {entries.length} {t("history.title").toLowerCase()}
        </span>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={envFilter}
            onValueChange={value => { if (value === "current" || value === "all") setEnvFilter(value) }}
            className="h-7"
          >
            <ToggleGroupItem value="current" className="h-7 px-2 text-[11px]">
              {t("history.currentEnv")}
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="h-7 px-2 text-[11px]">
              {t("history.allEnvs")}
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="ghost" size="xs" onClick={clearEntries}>
            <Trash2 />
            {t("history.clear")}
          </Button>
        </div>
      </div>

      {!entries.length && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>{t("history.empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {entries.map(entry => (
        <Collapsible key={entry.id}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card cursor-pointer hover:bg-accent/30 transition-colors">
              <Badge variant="outline" className={cn("text-[10px] font-bold border px-1.5 py-0", statusColor(entry.response.status))}>
                {entry.response.status}
              </Badge>
              <span className="text-xs font-mono truncate">{entry.method.toUpperCase()} {entry.path}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{entry.response.elapsed}ms</span>
              {envFilter === "all" && entry.envNameSnapshot && (
                <Badge variant="secondary" className="text-[10px]">
                  {entry.envNameSnapshot}
                </Badge>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale })}
              </span>
            </div>
          </CollapsibleTrigger>
          <AnimatedCollapsibleContent>
            <div className="mt-1 rounded-md border overflow-hidden">
              {entry.requestBody && (
                <div className="border-b">
                  <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground bg-muted/30">
                    {t("history.request")}
                  </div>
                  <JsonOrTable body={entry.requestBody} schema={requestBodySchema} maxHeight="120px" />
                </div>
              )}
              <div>
                <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground bg-muted/30">
                  {t("history.response")}
                </div>
                <JsonOrTable body={entry.response.body || ""} schema={getResponseSchema(route, entry.response.status)} maxHeight="200px" />
              </div>
            </div>
          </AnimatedCollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
})
