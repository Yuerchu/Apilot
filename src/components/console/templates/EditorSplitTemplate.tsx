import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, Save } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource } from "@/lib/console/types"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function EditorSplitTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<FormOutput>({})
  const [error, setError] = useState<string | null>(null)

  const readOp = resource.operations.read
  const updateOp = resource.operations.update
  const updateSchema = resource.updateSchema

  const fetchDetail = useCallback(async () => {
    if (!readOp) return
    setError(null)
    const result = await sendRequest(readOp.route, {}, "", "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        try {
          const parsed = JSON.parse(result.body)
          setData(parsed)
          setFormData(parsed)
        } catch { setData(null) }
      } else {
        setError(`${result.status} ${result.statusText}`)
      }
    }
  }, [readOp, sendRequest])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSave = async () => {
    if (!updateOp) return
    const body = JSON.stringify(formData)
    const result = await sendRequest(updateOp.route, {}, body, "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        toast.success(t("console.updated"))
        fetchDetail()
      } else {
        toast.error(t("console.updateFailed", { status: `${result.status} ${result.statusText}` }))
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
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

      <div className="grid gap-4 lg:grid-cols-2 flex-1 min-h-0">
        {/* Left: Current data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            )}
            {data && (
              <div className="rounded-md border overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(data).map(([key, value]) => (
                      <tr key={key} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground w-[140px] align-top bg-muted/20">{key}</td>
                        <td className="px-2 py-1.5 text-xs break-all">{renderValue(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("console.edit")}</CardTitle>
            <CardAction>
              <Button size="sm" onClick={handleSave} disabled={loading || !updateSchema}>
                <Save className="size-3.5 mr-1" />
                {t("console.save")}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {updateSchema ? (
              <SchemaForm schema={updateSchema} value={formData} onChange={handleChange} defaultExcludeOptional />
            ) : (
              <p className="text-sm text-muted-foreground">{t("console.noSchema")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null) return <span className="text-muted-foreground">null</span>
  if (value === undefined) return <span className="text-muted-foreground">—</span>
  if (typeof value === "boolean") return <Badge variant={value ? "default" : "secondary"}>{String(value)}</Badge>
  if (typeof value === "object") return <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
  return String(value)
}
