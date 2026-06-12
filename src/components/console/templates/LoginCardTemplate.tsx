import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { useAuthContext } from "@/contexts/AuthContext"
import { applyFieldLayout } from "@/lib/console/apply-layout"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { findTokenFields } from "@/lib/request-utils"
import { toast } from "sonner"
import type { TemplateProps } from "./index"

type FormOutput = Record<string, unknown> | unknown[]

export function LoginCardTemplate({ resource, layoutOverride }: TemplateProps) {
  const { t } = useTranslation()
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  const { submitJson, loading } = useConsoleFetch()
  const { applyToken } = useAuthContext()
  const [formData, setFormData] = useState<FormOutput>({})
  const [response, setResponse] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)

  const action = resource.actions.find(a => !!getRequestBodySchema(a.route)) ?? resource.operations.create
  const rawSchema = action ? getRequestBodySchema(action.route) : resource.createSchema
  const schema = rawSchema ? applyFieldLayout(rawSchema, layout?.formFields) : null

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    if (!action) return
    const { ok, response: resp } = await submitJson(action.route, JSON.stringify(formData))
    setResponse(resp)
    if (!ok) {
      toast.error(t("console.requestFailed"))
      setLoggedIn(false)
      return
    }
    const tokens = findTokenFields(resp)
    const top = tokens[0]
    if (top) {
      applyToken(top.value, top.key)
      setLoggedIn(true)
      toast.success(t("console.tokenApplied"))
    } else {
      toast.success(t("console.ok"))
    }
  }

  return (
    <div className="flex items-start justify-center py-12 h-full overflow-auto">
      <Card className="w-full max-w-md">
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
        <CardFooter className="flex-col gap-2">
          <Button onClick={handleSubmit} disabled={loading || !schema} className="w-full">
            {loading ? t("console.saving") : (action?.label ?? t("console.execute"))}
          </Button>
          {loggedIn && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              {t("console.sessionActive")}
            </div>
          )}
        </CardFooter>
        {response && (
          <CardContent>
            <pre className="rounded-md border bg-muted/30 p-3 text-xs overflow-auto max-h-[200px]">{response}</pre>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
