import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Lock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { applyFieldLayout } from "@/lib/console/apply-layout"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { detectConfirmPasswordPair } from "@/lib/console/template-utils"
import { toast } from "sonner"
import type { TemplateProps } from "./index"

type FormOutput = Record<string, unknown> | unknown[]

export function PasswordChangeTemplate({ resource, layoutOverride }: TemplateProps) {
  const { t } = useTranslation()
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  const { mutate, loading } = useConsoleFetch()
  const [formData, setFormData] = useState<FormOutput>({})
  const [success, setSuccess] = useState(false)
  const [mismatch, setMismatch] = useState(false)

  const action = resource.actions.find(a => !!getRequestBodySchema(a.route)) ?? resource.operations.create ?? resource.operations.update
  const rawSchema = action ? getRequestBodySchema(action.route) : (resource.createSchema ?? resource.updateSchema)
  const schema = rawSchema ? applyFieldLayout(rawSchema, layout?.formFields) : null

  const handleChange = useCallback((v: FormOutput) => { setFormData(v); setMismatch(false) }, [])

  const handleSubmit = async () => {
    if (!action) return
    const pair = detectConfirmPasswordPair(rawSchema)
    if (pair && !Array.isArray(formData)) {
      const values = formData as Record<string, unknown>
      if (values[pair.primary] !== values[pair.confirm]) {
        setMismatch(true)
        return
      }
    }
    const ok = await mutate(action.route, { body: JSON.stringify(formData) })
    if (ok) { toast.success(t("console.updated")); setSuccess(true); setFormData({}) }
    else toast.error(t("console.updateFailed", { status: "" }))
  }

  return (
    <div className="flex items-start justify-center py-12 h-full overflow-auto">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-full bg-muted p-3 w-fit">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>{resource.displayName}</CardTitle>
          <CardDescription className="font-mono text-xs">{resource.basePath}</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center py-4">
              <p className="text-sm text-emerald-600">{t("console.updated")}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSuccess(false)}>
                Reset
              </Button>
            </div>
          ) : schema ? (
            <SchemaForm schema={schema} value={formData} onChange={handleChange} />
          ) : (
            <p className="text-sm text-muted-foreground text-center">{t("console.noSchema")}</p>
          )}
        </CardContent>
        {!success && (
          <CardFooter className="flex-col gap-2">
            {mismatch && (
              <p className="text-xs text-destructive w-full">{t("console.passwordMismatch")}</p>
            )}
            <Button onClick={handleSubmit} disabled={loading || !schema} className="w-full">
              {loading ? t("console.saving") : t("console.save")}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
