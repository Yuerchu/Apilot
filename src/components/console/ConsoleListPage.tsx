import { useEffect, useState, useCallback, useMemo } from "react"
import { Plus, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConsoleTableView } from "./ConsoleTableView"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import type { Parameter } from "@/lib/openapi/types"
import { Skeleton } from "@/components/ui/skeleton"
import { ConsoleActionButton } from "./ConsoleActionButton"
import { ConsoleFilterBar } from "./ConsoleFilterBar"
import { toast } from "sonner"

const PAGE_SIZES = [20, 50, 100]

interface PaginationState {
  offset: number
  limit: number
}

const OFFSET_NAMES = new Set(["offset", "skip", "start", "from", "page", "pagenum", "page_num", "page_number", "pagenumber", "current", "current_page"])
const LIMIT_NAMES = new Set(["limit", "size", "pagesize", "page_size", "per_page", "perpage", "count", "take", "rows", "max_results", "maxresults"])

function detectPaginationParams(params: Parameter[]): { offsetParam: string | null; limitParam: string | null; isPageBased: boolean } {
  let offsetParam: string | null = null
  let limitParam: string | null = null
  let isPageBased = false

  for (const p of params) {
    if (p.in !== "query") continue
    const t = p.type ?? p.schema?.type
    if (t !== "integer" && t !== "number") continue
    const n = p.name.toLowerCase()
    if (!offsetParam && OFFSET_NAMES.has(n)) {
      offsetParam = p.name
      isPageBased = n.includes("page")
    }
    if (!limitParam && LIMIT_NAMES.has(n)) {
      limitParam = p.name
    }
  }

  return { offsetParam, limitParam, isPageBased }
}

export function ConsoleListPage({ resource }: { resource: ConsoleResource }) {
  const { dispatch } = useConsoleContext()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [data, setData] = useState<unknown>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({ offset: 0, limit: 100 })
  const [filters, setFilters] = useState<Record<string, string>>({})

  const listOp = resource.operations.list
  const listParams = listOp?.route.parameters ?? []

  const { offsetParam, limitParam, isPageBased } = useMemo(
    () => detectPaginationParams(listParams),
    [listParams],
  )
  const hasPagination = !!(offsetParam || limitParam)

  const excludedFilterParams = useMemo(() => {
    const s = new Set<string>()
    if (offsetParam) s.add(offsetParam)
    if (limitParam) s.add(limitParam)
    return s
  }, [offsetParam, limitParam])

  const defaultLimit = useMemo(() => {
    if (!limitParam) return 100
    const p = listParams.find(lp => lp.name === limitParam)
    const d = p?.default ?? p?.schema?.default
    return typeof d === "number" ? d : 100
  }, [limitParam, listParams])

  const fetchList = useCallback(async () => {
    if (!listOp) return
    setError(null)
    const params: Record<string, string> = { ...filters }
    if (hasPagination) {
      if (offsetParam) {
        params[offsetParam] = isPageBased
          ? String(Math.floor(pagination.offset / pagination.limit) + 1)
          : String(pagination.offset)
      }
      if (limitParam) params[limitParam] = String(pagination.limit)
    }
    const result = await sendRequest(listOp.route, params, "", "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        try {
          const parsed = JSON.parse(result.body)
          setData(parsed)
          extractTotalCount(parsed)
        } catch {
          setData(result.body)
        }
      } else {
        setError(`${result.status} ${result.statusText}`)
      }
    }
  }, [resource, sendRequest, listOp, hasPagination, offsetParam, limitParam, isPageBased, pagination, filters])

  const extractTotalCount = (parsed: unknown) => {
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      for (const key of ["total", "count", "total_count", "totalCount", "totalItems"]) {
        if (typeof obj[key] === "number") {
          setTotalCount(obj[key] as number)
          return
        }
      }
    }
    if (Array.isArray(parsed)) {
      setTotalCount(parsed.length)
    }
    setTotalCount(null)
  }

  useEffect(() => {
    setPagination(prev => prev.limit === 100 && defaultLimit !== 100 ? { offset: 0, limit: defaultLimit } : prev)
  }, [defaultLimit])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const hasCreate = !!resource.operations.create
  const hasUpdate = !!resource.operations.update
  const hasDelete = !!resource.operations.delete

  const handleEdit = useCallback((row: Record<string, unknown>) => {
    dispatch({ type: "SET_SUB_VIEW", view: "edit", itemId: String(row[resource.idParam ?? "id"] ?? "") })
  }, [dispatch, resource.idParam])

  const handleDelete = useCallback(async (row: Record<string, unknown>) => {
    const deleteOp = resource.operations.delete
    if (!deleteOp || !resource.idParam) return
    const id = String(row[resource.idParam] ?? row["id"] ?? "")
    if (!id) return
    const params: Record<string, string> = { [resource.idParam]: id }
    const result = await sendRequest(deleteOp.route, params, "", "application/json")
    if (result && result.status >= 200 && result.status < 300) {
      toast.success(`Deleted ${id}`)
      fetchList()
    } else {
      toast.error(`Delete failed: ${result?.status} ${result?.statusText}`)
    }
  }, [resource, sendRequest, fetchList])

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = totalCount !== null ? Math.ceil(totalCount / pagination.limit) : null

  const goPage = (page: number) => {
    setPagination(prev => ({ ...prev, offset: (page - 1) * prev.limit }))
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold truncate">{resource.displayName}</h2>
            <span className="flex gap-0.5 shrink-0">
              {resource.operations.list && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-emerald-500/15 text-emerald-600">L</Badge>}
              {resource.operations.create && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-600">C</Badge>}
              {resource.operations.read && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-500/15 text-blue-600">R</Badge>}
              {resource.operations.update && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-violet-500/15 text-violet-600">U</Badge>}
              {resource.operations.delete && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-red-500/15 text-red-600">D</Badge>}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">{resource.basePath}</p>
        </div>
        {resource.actions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">Actions:</span>
            {resource.actions.map((action, i) => (
              <ConsoleActionButton key={i} action={action} />
            ))}
          </div>
        )}
      </div>

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

      {/* Filters */}
      {listParams.length > 0 && (
        <ConsoleFilterBar
          params={listParams}
          excludeParams={excludedFilterParams}
          onSearch={newFilters => {
            setFilters(newFilters)
            setPagination(prev => ({ ...prev, offset: 0 }))
          }}
        />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
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
            hasEdit={hasUpdate}
            hasDelete={hasDelete}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* Pagination */}
      {hasPagination && data !== null && (
        <div className="flex items-center gap-3 py-1 text-sm shrink-0">
          {totalCount !== null && (
            <span className="text-xs text-muted-foreground">
              {totalCount} items
            </span>
          )}
          <div className="flex-1" />
          <Select
            value={String(pagination.limit)}
            onValueChange={v => setPagination({ offset: 0, limit: Number(v) })}
          >
            <SelectTrigger className="h-7 w-auto text-xs gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(s => (
                <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              size="sm" variant="outline" className="h-7 w-7 p-0"
              disabled={currentPage <= 1}
              onClick={() => goPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs px-2">
              {currentPage}{totalPages !== null ? ` / ${totalPages}` : ""}
            </span>
            <Button
              size="sm" variant="outline" className="h-7 w-7 p-0"
              disabled={totalPages !== null && currentPage >= totalPages}
              onClick={() => goPage(currentPage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty */}
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
