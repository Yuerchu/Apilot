import { useEffect, useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, Save } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { applyDetailLayout, applyFieldLayout } from "@/lib/console/apply-layout"
import { stableEqual } from "@/lib/console/template-utils"
import { ConfirmDialog } from "../ConfirmDialog"
import { toast } from "sonner"
import type { TemplateProps } from "./index"

type FormOutput = Record<string, unknown> | unknown[]

export function EditorSplitTemplate({ resource, layoutOverride }: TemplateProps) {
  const { t } = useTranslation()
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  const { fetchJson, mutate, loading } = useConsoleFetch()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<FormOutput>({})
  const [error, setError] = useState<string | null>(null)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  const readOp = resource.operations.read
  const updateOp = resource.operations.update
  const updateSchema = resource.updateSchema ? applyFieldLayout(resource.updateSchema, layout?.updateFields) : null

  const dirty = useMemo(() => data !== null && !stableEqual(formData, data), [formData, data])

  const fetchDetail = useCallback(async () => {
    if (!readOp) return
    setError(null)
    const { data: parsed, error: err } = await fetchJson<Record<string, unknown>>(readOp.route)
    if (parsed) { setData(parsed); setFormData(parsed) }
    else setData(null)
    setError(err)
  }, [readOp, fetchJson])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleRefresh = useCallback(() => {
    if (dirty) setDiscardConfirmOpen(true)
    else fetchDetail()
  }, [dirty, fetchDetail])

  const handleSave = async () => {
    if (!updateOp) return
    const ok = await mutate(updateOp.route, { body: JSON.stringify(formData) })
    if (ok) { toast.success(t("console.updated")); fetchDetail() }
    else toast.error(t("console.updateFailed", { status: "" }))
  }

  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
        {dirty && (
          <Badge variant="outline" className="text-amber-600 border-amber-600/40">
            {t("console.unsavedChanges")}
          </Badge>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <ConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title={t("console.discardChanges")}
        description={t("console.discardChangesConfirm")}
        confirmLabel={t("console.discardChanges")}
        destructive
        onConfirm={() => { setDiscardConfirmOpen(false); fetchDetail() }}
      />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 flex-1 min-h-0">
        {/* Left: Current data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("console.current")}</CardTitle>
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
                    {applyDetailLayout(data, layout?.detailFields).map(({ key, label, value }) => (
                      <tr key={key} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground w-[140px] align-top bg-muted/20">{label}</td>
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
              <Button size="sm" variant={dirty ? "default" : "outline"} onClick={handleSave} disabled={loading || !updateSchema}>
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
