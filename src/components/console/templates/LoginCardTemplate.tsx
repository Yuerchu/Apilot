import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import type { ConsoleResource } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function LoginCardTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const { submitJson, loading } = useConsoleFetch()
  const [formData, setFormData] = useState<FormOutput>({})
  const [response, setResponse] = useState<string | null>(null)

  const action = resource.actions.find(a => !!getRequestBodySchema(a.route)) ?? resource.operations.create
  const schema = action ? getRequestBodySchema(action.route) : resource.createSchema

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    if (!action) return
    const { ok, response: resp } = await submitJson(action.route, JSON.stringify(formData))
    if (ok) toast.success("OK")
    else toast.error("Failed")
    setResponse(resp)
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
        <CardFooter>
          <Button onClick={handleSubmit} disabled={loading || !schema} className="w-full">
            {loading ? t("console.saving") : (action?.label ?? t("console.execute"))}
          </Button>
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
