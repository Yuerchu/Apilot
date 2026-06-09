import { useEffect, useState, useCallback } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConsoleTableView } from "./ConsoleTableView"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { Skeleton } from "@/components/ui/skeleton"
import { ConsoleActionButton } from "./ConsoleActionButton"

export function ConsoleListPage({ resource }: { resource: ConsoleResource }) {
  const { dispatch } = useConsoleContext()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    const listOp = resource.operations.list
    if (!listOp) return
    setError(null)
    const result = await sendRequest(listOp.route, {}, "", "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        try {
          setData(JSON.parse(result.body))
        } catch {
          setData(result.body)
        }
      } else {
        setError(`${result.status} ${result.statusText}`)
      }
    }
  }, [resource, sendRequest])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const hasCreate = !!resource.operations.create

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header: resource path + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate">{resource.displayName}</h2>
          <p className="text-xs text-muted-foreground font-mono truncate">{resource.basePath}</p>
        </div>
        {resource.actions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Actions:</span>
            {resource.actions.map((action, i) => (
              <ConsoleActionButton key={i} action={action} />
            ))}
          </div>
        )}
      </div>

      {/* Hints */}
      {resource.hints.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {resource.hints.map((hint, i) => (
            <Badge key={i} variant="outline" className="text-[10px] text-amber-600 border-amber-300" title={hint.message}>
              {hint.code}: {hint.suggestion}
            </Badge>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {hasCreate && (
          <Button size="sm" onClick={() => dispatch({ type: "SET_SUB_VIEW", view: "create" })}>
            <Plus className="size-4 mr-1.5" />
            Create
          </Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={fetchList} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && data === null && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {/* Table */}
      {data !== null && (
        <div className="flex-1 min-h-0">
          <ConsoleTableView
            data={extractListData(data)}
            schema={resource.listItemSchema ?? undefined}
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && data === null && !error && !resource.operations.list && (
        <div className="text-sm text-muted-foreground text-center py-8">
          This resource has no list endpoint.
        </div>
      )}
    </div>
  )
}

function extractListData(data: unknown): unknown {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    for (const key of ["items", "data", "results", "records", "rows", "list", "content", "entries"]) {
      if (Array.isArray(obj[key])) return obj[key]
    }
  }
  return data
}
