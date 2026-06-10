import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource, ResourceAction } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function ActionFormTemplate({ resource }: { resource: ConsoleResource }) {
  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div>
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
      </div>
      <div className="grid gap-4 max-w-3xl">
        {resource.actions.map((action, i) => (
          <ActionCard key={i} action={action} />
        ))}
      </div>
    </div>
  )
}

function ActionCard({ action }: { action: ResourceAction }) {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [formData, setFormData] = useState<FormOutput>({})
  const [response, setResponse] = useState<string | null>(null)

  const schema = getRequestBodySchema(action.route)
  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    const body = schema ? JSON.stringify(formData) : ""
    const result = await sendRequest(action.route, {}, body, "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        toast.success(`${action.label}: ${result.status}`)
        try { setResponse(JSON.stringify(JSON.parse(result.body), null, 2)) } catch { setResponse(result.body) }
      } else {
        toast.error(`${action.label}: ${result.status} ${result.statusText}`)
        setResponse(result.body)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="font-mono text-[10px]">
            {action.route.method.toUpperCase()}
          </Badge>
          {action.label}
        </CardTitle>
        {action.route.description && (
          <CardDescription className="text-xs">{action.route.description}</CardDescription>
        )}
      </CardHeader>
      {schema && (
        <CardContent>
          <SchemaForm schema={schema} value={formData} onChange={handleChange} />
        </CardContent>
      )}
      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading}>
          {loading ? t("console.running") : t("console.execute")}
        </Button>
      </CardFooter>
      {response && (
        <CardContent>
          <pre className="rounded-md border bg-muted/30 p-3 text-xs overflow-auto max-h-[200px]">{response}</pre>
        </CardContent>
      )}
    </Card>
  )
}
