import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { applyFieldLayout } from "@/lib/console/apply-layout"
import type { FormFieldConfig, ResourceAction } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { PathParamFields, getPathParams, hasAllRequiredPathParams } from "../PathParamFields"
import { toast } from "sonner"
import type { TemplateProps } from "./index"

type FormOutput = Record<string, unknown> | unknown[]

export function ActionFormTemplate({ resource, layoutOverride }: TemplateProps) {
  const { activeLayout } = useConsoleContext()
  const layout = layoutOverride ?? activeLayout
  return (
    <div className="flex flex-col gap-4 py-4 h-full overflow-auto">
      <div>
        <h2 className="text-base font-semibold">{resource.displayName}</h2>
        <p className="text-xs text-muted-foreground font-mono">{resource.basePath}</p>
      </div>
      <div className="grid gap-4 max-w-3xl">
        {resource.actions.map((action, i) => (
          // formFields apply to the first action card only (single-form layout config)
          <ActionCard key={i} action={action} fieldConfigs={i === 0 ? layout?.formFields : undefined} />
        ))}
      </div>
    </div>
  )
}

function ActionCard({ action, fieldConfigs }: { action: ResourceAction; fieldConfigs?: FormFieldConfig[] | undefined }) {
  const { t } = useTranslation()
  const { submitJson, loading } = useConsoleFetch()
  const [formData, setFormData] = useState<FormOutput>({})
  const [response, setResponse] = useState<string | null>(null)
  const [pathParams, setPathParams] = useState<Record<string, string>>({})

  const rawSchema = getRequestBodySchema(action.route)
  const schema = rawSchema ? applyFieldLayout(rawSchema, fieldConfigs) : null
  const routePathParams = getPathParams(action.route)
  const canSubmit = hasAllRequiredPathParams(action.route, pathParams)
  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    const body = schema ? JSON.stringify(formData) : ""
    const { ok, response: resp } = await submitJson(action.route, body, pathParams)
    if (ok) toast.success(`${action.label}: OK`)
    else toast.error(`${action.label}: failed`)
    setResponse(resp)
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
      {(routePathParams.length > 0 || schema) && (
        <CardContent className="flex flex-col gap-3">
          {routePathParams.length > 0 && (
            <PathParamFields route={action.route} values={pathParams} onChange={setPathParams} />
          )}
          {schema && <SchemaForm schema={schema} value={formData} onChange={handleChange} />}
        </CardContent>
      )}
      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading || !canSubmit}>
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
