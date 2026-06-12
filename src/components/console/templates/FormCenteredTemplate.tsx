import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { applyFieldLayout } from "@/lib/console/apply-layout"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { toast } from "sonner"
import type { TemplateProps } from "./index"

type FormOutput = Record<string, unknown> | unknown[]

export function FormCenteredTemplate({ resource, layoutOverride }: TemplateProps) {
  const { t } = useTranslation()
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  const { submitJson, loading } = useConsoleFetch()
  const [formData, setFormData] = useState<FormOutput>({})
  const [response, setResponse] = useState<string | null>(null)

  const op = resource.operations.create
  const action = !op ? resource.actions.find(a => !!getRequestBodySchema(a.route)) : null
  const route = op?.route ?? action?.route
  const rawSchema = op ? resource.createSchema : (action ? getRequestBodySchema(action.route) : null)
  const schema = rawSchema ? applyFieldLayout(rawSchema, layout?.formFields) : null
  const label = op?.label ?? action?.label ?? t("console.execute")

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    if (!route) return
    const { ok, response: resp } = await submitJson(route, JSON.stringify(formData))
    setResponse(resp)
    if (ok) {
      toast.success(t("console.created"))
      setFormData({})
    } else {
      toast.error(t("console.createFailed", { status: resp.slice(0, 50) }))
    }
  }

  return (
    <div className="flex items-start justify-center py-8 h-full overflow-auto">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{resource.displayName}</CardTitle>
          <CardDescription className="font-mono text-xs">{resource.basePath}</CardDescription>
        </CardHeader>
        <CardContent>
          {schema ? (
            <SchemaForm schema={schema} value={formData} onChange={handleChange} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("console.noSchema")}</p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={handleSubmit} disabled={loading || !schema}>
            {loading ? t("console.saving") : label}
          </Button>
        </CardFooter>
        {response && (
          <CardContent>
            <pre className="rounded-md border bg-muted/30 p-3 text-xs overflow-auto max-h-[300px]">{response}</pre>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
