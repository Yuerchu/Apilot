import { useEffect, useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AgCharts } from "ag-charts-react"
import { ModuleRegistry, AllCommunityModule } from "ag-charts-community"
import type { AgChartOptions } from "ag-charts-community"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { categorizeStats } from "@/lib/console/apply-layout"
import { useTheme } from "next-themes"
import { ConsoleActionButton } from "../ConsoleActionButton"
import { PathParamFields, getPathParams, hasAllRequiredPathParams } from "../PathParamFields"
import type { TemplateProps } from "./index"

ModuleRegistry.registerModules([AllCommunityModule])

export function StatsDashboardTemplate({ resource, layoutOverride }: TemplateProps) {
  const { t } = useTranslation()
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  const { fetchJson, loading } = useConsoleFetch()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pathParams, setPathParams] = useState<Record<string, string>>({})

  const readOp = resource.operations.read ?? resource.operations.list
  const action = !readOp ? resource.actions[0] : null
  const activeRoute = readOp?.route ?? action?.route ?? null
  const needsInput = !!activeRoute && getPathParams(activeRoute).length > 0

  const fetchData = useCallback(async () => {
    if (!activeRoute || !hasAllRequiredPathParams(activeRoute, pathParams)) return
    setError(null)
    const { data: parsed, error: err } = await fetchJson<Record<string, unknown>>(activeRoute, pathParams)
    setData(parsed)
    setError(err)
  }, [activeRoute, fetchJson, pathParams])

  useEffect(() => { if (!needsInput) fetchData() }, [needsInput, fetchData])

  const statsConfig = layout?.statsConfig

  // Auto-refresh on the configured interval (seconds)
  const refreshInterval = statsConfig?.refreshInterval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return
    const timer = setInterval(fetchData, refreshInterval * 1000)
    return () => clearInterval(timer)
  }, [refreshInterval, fetchData])
  const { statCards, chartData } = useMemo(() => categorizeStats(data, statsConfig), [data, statsConfig])
  const { resolvedTheme } = useTheme()
  const chartOptions = useMemo(
    () => buildChartOptions(chartData, resolvedTheme === "dark", statsConfig),
    [chartData, resolvedTheme, statsConfig],
  )

  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
        {refreshInterval && refreshInterval > 0 ? (
          <span className="text-[10px] text-muted-foreground">{t("console.autoRefresh", { seconds: refreshInterval })}</span>
        ) : null}
        <div className="flex-1" />
        {resource.actions.map((a, i) => <ConsoleActionButton key={i} action={a} pathParams={pathParams} />)}
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {needsInput && activeRoute && (
        <PathParamFields
          route={activeRoute}
          values={pathParams}
          onChange={setPathParams}
          onLoad={fetchData}
          loading={loading}
        />
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading && !data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {statCards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ key, value, label }) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatStatValue(value)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <AgCharts options={chartOptions} />
          </CardContent>
        </Card>
      )}

      {data && statCards.length === 0 && chartData.length === 0 && (
        <Card>
          <CardContent className="pt-4">
            <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatStatValue(value: unknown): string {
  if (typeof value === "number") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return String(value)
}

function buildChartOptions(
  data: Array<{ label: string; value: number }>,
  dark: boolean,
  config?: import("@/lib/console/types").StatsConfig | undefined,
): AgChartOptions {
  return {
    data,
    series: [{ type: config?.chartType ?? "bar", xKey: "label", yKey: "value" }],
    background: { fill: "transparent" },
    height: config?.chartHeight ?? 300,
    theme: dark ? "ag-default-dark" : "ag-default",
  }
}
