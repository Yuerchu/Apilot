import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, Pencil } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleFormDialog } from "../ConsoleFormDialog"
import { ConsoleActionButton } from "../ConsoleActionButton"

export function DetailCardTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const { state, dispatch } = useConsoleContext()
  const { fetchJson, loading } = useConsoleFetch()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readOp = resource.operations.read
  const hasUpdate = !!resource.operations.update

  const fetchDetail = useCallback(async () => {
    if (!readOp) return
    setError(null)
    const { data: parsed, error: err } = await fetchJson<Record<string, unknown>>(readOp.route)
    setData(parsed)
    setError(err)
  }, [readOp, fetchJson])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div className="max-w-3xl w-full mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{resource.displayName}</CardTitle>
            <CardDescription className="font-mono text-xs">{resource.basePath}</CardDescription>
            <CardAction>
              <div className="flex gap-1">
                {hasUpdate && (
                  <Button size="sm" variant="outline" onClick={() => dispatch({ type: "SET_SUB_VIEW", view: "edit" })}>
                    <Pencil className="size-3.5 mr-1" />
                    {t("console.edit")}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={fetchDetail} disabled={loading}>
                  <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardAction>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {error}
              </div>
            )}

            {loading && !data && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            )}

            {data && (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(data).map(([key, value]) => (
                      <tr key={key} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-mono text-xs font-medium text-muted-foreground w-[180px] align-top bg-muted/20">
                          {key}
                        </td>
                        <td className="px-3 py-2 break-all">{renderValue(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {resource.actions.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {resource.actions.map((action, i) => (
              <ConsoleActionButton key={i} action={action} />
            ))}
          </div>
        )}
      </div>

      {state.subView === "edit" && data && (
        <ConsoleFormDialog resource={resource} mode="edit" initialData={data} onSuccess={fetchDetail} />
      )}
    </div>
  )
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null) return <span className="text-muted-foreground">null</span>
  if (value === undefined) return <span className="text-muted-foreground">—</span>
  if (typeof value === "boolean") return <Badge variant={value ? "default" : "secondary"}>{String(value)}</Badge>
  if (typeof value === "object") return <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
  return String(value)
}
