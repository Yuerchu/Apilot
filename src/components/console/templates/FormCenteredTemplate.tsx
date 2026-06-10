import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function FormCenteredTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [formData, setFormData] = useState<FormOutput>({})
  const [response, setResponse] = useState<string | null>(null)

  const op = resource.operations.create
  const action = !op ? resource.actions.find(a => !!getRequestBodySchema(a.route)) : null
  const route = op?.route ?? action?.route
  const schema = op ? resource.createSchema : (action ? getRequestBodySchema(action.route) : null)
  const label = op?.label ?? action?.label ?? t("console.execute")

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    if (!route) return
    const body = JSON.stringify(formData)
    const result = await sendRequest(route, {}, body, "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        toast.success(t("console.created"))
        try { setResponse(JSON.stringify(JSON.parse(result.body), null, 2)) } catch { setResponse(result.body) }
      } else {
        toast.error(t("console.createFailed", { status: `${result.status} ${result.statusText}` }))
        setResponse(result.body)
      }
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
