import { useEffect, useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, Save } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { applyFieldLayout } from "@/lib/console/apply-layout"
import { stableEqual } from "@/lib/console/template-utils"
import { ConfirmDialog } from "../ConfirmDialog"
import { PathParamFields, getPathParams, hasAllRequiredPathParams } from "../PathParamFields"
import { toast } from "sonner"
import type { TemplateProps } from "./index"

type FormOutput = Record<string, unknown> | unknown[]

export function ConfigFormTemplate({ resource, layoutOverride }: TemplateProps) {
  const { t } = useTranslation()
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  const { fetchJson, mutate, loading } = useConsoleFetch()
  const [data, setData] = useState<FormOutput | null>(null)
  const [formData, setFormData] = useState<FormOutput>({})
  const [error, setError] = useState<string | null>(null)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [pathParams, setPathParams] = useState<Record<string, string>>({})

  const readOp = resource.operations.read
  const updateOp = resource.operations.update
  const rawSchema = resource.updateSchema ?? resource.detailSchema
  const schema = rawSchema ? applyFieldLayout(rawSchema, layout?.formFields) : null
  const needsInput = !!readOp && getPathParams(readOp.route).length > 0

  const dirty = useMemo(() => data !== null && !stableEqual(formData, data), [formData, data])

  const fetchConfig = useCallback(async () => {
    if (!readOp || !hasAllRequiredPathParams(readOp.route, pathParams)) return
    setError(null)
    const { data: parsed, error: err } = await fetchJson<FormOutput>(readOp.route, pathParams)
    if (parsed) { setData(parsed); setFormData(parsed) }
    setError(err)
  }, [readOp, fetchJson, pathParams])

  useEffect(() => { if (!needsInput) fetchConfig() }, [needsInput, fetchConfig])

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleRefresh = useCallback(() => {
    if (dirty) setDiscardConfirmOpen(true)
    else fetchConfig()
  }, [dirty, fetchConfig])

  const handleSave = async () => {
    if (!updateOp) return
    const ok = await mutate(updateOp.route, { body: JSON.stringify(formData), params: pathParams })
    if (ok) { toast.success(t("console.updated")); fetchConfig() }
    else toast.error(t("console.updateFailed", { status: "" }))
  }

  return (
    <div className="flex items-start justify-center py-8 h-full overflow-auto">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{resource.displayName}</CardTitle>
          <CardDescription className="font-mono text-xs">{resource.basePath}</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {needsInput && readOp && (
            <div className="mb-4">
              <PathParamFields
                route={readOp.route}
                values={pathParams}
                onChange={setPathParams}
                onLoad={fetchConfig}
                loading={loading}
              />
            </div>
          )}

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
          <CardFooter className="gap-2">
            <Button onClick={handleSave} disabled={loading} variant={dirty ? "default" : "outline"}>
              <Save className="size-4 mr-1.5" />
              {loading ? t("console.saving") : t("console.save")}
            </Button>
            {dirty && (
              <Badge variant="outline" className="text-amber-600 border-amber-600/40">
                {t("console.unsavedChanges")}
              </Badge>
            )}
          </CardFooter>
        )}
      </Card>

      <ConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title={t("console.discardChanges")}
        description={t("console.discardChangesConfirm")}
        confirmLabel={t("console.discardChanges")}
        destructive
        onConfirm={() => { setDiscardConfirmOpen(false); fetchConfig() }}
      />
    </div>
  )
}
