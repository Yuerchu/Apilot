import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, Save } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource } from "@/lib/console/types"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function ConfigFormTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [data, setData] = useState<FormOutput | null>(null)
  const [formData, setFormData] = useState<FormOutput>({})
  const [error, setError] = useState<string | null>(null)

  const readOp = resource.operations.read
  const updateOp = resource.operations.update
  const schema = resource.updateSchema ?? resource.detailSchema

  const fetchConfig = useCallback(async () => {
    if (!readOp) return
    setError(null)
    const result = await sendRequest(readOp.route, {}, "", "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        try {
          const parsed = JSON.parse(result.body)
          setData(parsed)
          setFormData(parsed)
        } catch { /* ignore */ }
      } else {
        setError(`${result.status} ${result.statusText}`)
      }
    }
  }, [readOp, sendRequest])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSave = async () => {
    if (!updateOp) return
    const body = JSON.stringify(formData)
    const result = await sendRequest(updateOp.route, {}, body, "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        toast.success(t("console.updated"))
        fetchConfig()
      } else {
        toast.error(t("console.updateFailed", { status: `${result.status} ${result.statusText}` }))
      }
    }
  }

  return (
    <div className="flex items-start justify-center py-8 h-full overflow-auto">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{resource.displayName}</CardTitle>
          <CardDescription className="font-mono text-xs">{resource.basePath}</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" onClick={fetchConfig} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive mb-4">{error}</div>
          )}

          {loading && !data && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          )}

          {schema && data !== null && (
            <SchemaForm schema={schema} value={formData} onChange={handleChange} defaultExcludeOptional />
          )}

          {!schema && data !== null && (
            <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
          )}
        </CardContent>

        {updateOp && (
          <CardFooter>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="size-4 mr-1.5" />
              {loading ? t("console.saving") : t("console.save")}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
