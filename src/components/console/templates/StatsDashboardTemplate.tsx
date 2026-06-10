import { useEffect, useState, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AgCharts } from "ag-charts-react"
import type { AgChartOptions } from "ag-charts-community"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleActionButton } from "../ConsoleActionButton"

export function StatsDashboardTemplate({ resource }: { resource: ConsoleResource }) {
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readOp = resource.operations.read ?? resource.operations.list
  const action = !readOp ? resource.actions[0] : null

  const fetchData = useCallback(async () => {
    const route = readOp?.route ?? action?.route
    if (!route) return
    setError(null)
    const result = await sendRequest(route, {}, "", "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        try { setData(JSON.parse(result.body)) } catch { setData(null) }
      } else {
        setError(`${result.status} ${result.statusText}`)
      }
    }
  }, [readOp, action, sendRequest])

  useEffect(() => { fetchData() }, [fetchData])

  const { statCards, chartData } = categorizeFields(data)

  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
        <div className="flex-1" />
        {resource.actions.map((a, i) => <ConsoleActionButton key={i} action={a} />)}
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

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
            <AgCharts options={buildChartOptions(chartData)} />
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

interface StatCard {
  key: string
  label: string
  value: unknown
}

interface ChartDataPoint {
  label: string
  value: number
}

function categorizeFields(data: Record<string, unknown> | null): { statCards: StatCard[]; chartData: ChartDataPoint[] } {
  if (!data || Array.isArray(data)) return { statCards: [], chartData: [] }
  const statCards: StatCard[] = []
  const chartData: ChartDataPoint[] = []

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const label = key.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      statCards.push({ key, label, value })
      chartData.push({ label, value })
    } else if (typeof value === "string" && value.trim() !== "") {
      const num = Number(value)
      if (Number.isFinite(num)) {
        const label = key.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
        statCards.push({ key, label, value: num })
        chartData.push({ label, value: num })
      }
    }
  }

  return { statCards, chartData }
}

function formatStatValue(value: unknown): string {
  if (typeof value === "number") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return String(value)
}

function buildChartOptions(data: ChartDataPoint[]): AgChartOptions {
  return {
    data,
    series: [{ type: "bar", xKey: "label", yKey: "value" }],
    background: { fill: "transparent" },
    height: 300,
  }
}
