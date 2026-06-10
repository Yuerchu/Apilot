import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleActionButton } from "./ConsoleActionButton"
import { ConsoleFormDialog } from "./ConsoleFormDialog"

export function ConsoleDetailPage({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const { state, dispatch } = useConsoleContext()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readOp = resource.operations.read
  const hasUpdate = !!resource.operations.update

  const fetchDetail = useCallback(async () => {
    if (!readOp) return
    setError(null)
    const result = await sendRequest(readOp.route, {}, "", "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        try { setData(JSON.parse(result.body) as Record<string, unknown>) } catch { setData(null) }
      } else {
        setError(`${result.status} ${result.statusText}`)
      }
    }
  }, [readOp, sendRequest])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate">{resource.displayName}</h2>
          <p className="text-xs text-muted-foreground font-mono truncate">{resource.basePath}</p>
        </div>
        {resource.actions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {resource.actions.map((action, i) => (
              <ConsoleActionButton key={i} action={action} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {hasUpdate && (
          <Button size="sm" onClick={() => dispatch({ type: "SET_SUB_VIEW", view: "edit" })}>
            <Pencil className="size-4 mr-1.5" />
            {t("console.edit")}
          </Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={fetchDetail} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      )}

      {data && (
        <div className="rounded-md border overflow-auto flex-1">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(data).map(([key, value]) => (
                <tr key={key} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-mono text-xs font-medium text-muted-foreground w-[200px] align-top bg-muted/30">
                    {key}
                  </td>
                  <td className="px-3 py-2 break-all">
                    {renderValue(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.subView === "edit" && data && (
        <ConsoleFormDialog resource={resource} mode="edit" initialData={data} onSuccess={fetchDetail} />
      )}
    </div>
  )
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null) return <span className="text-muted-foreground">null</span>
  if (value === undefined) return <span className="text-muted-foreground">—</span>
  if (typeof value === "boolean") {
    return <Badge variant={value ? "default" : "secondary"}>{String(value)}</Badge>
  }
  if (typeof value === "object") {
    return <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
  }
  return String(value)
}
