import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleActionButton } from "./ConsoleActionButton"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function ConsoleFormPage({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [formData, setFormData] = useState<FormOutput>({})
  const [response, setResponse] = useState<string | null>(null)

  const createOp = resource.operations.create
  const schema = resource.createSchema

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    if (!createOp) return
    const body = JSON.stringify(formData)
    const result = await sendRequest(createOp.route, {}, body, "application/json")
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
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate">{resource.displayName}</h2>
          <p className="text-xs text-muted-foreground font-mono truncate">{resource.basePath}</p>
        </div>
        {resource.actions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {resource.actions.map((action, i) => (
              <ConsoleActionButton key={i} action={action} />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl">
          {schema ? (
            <>
              <SchemaForm schema={schema} value={formData} onChange={handleChange} />
              <div className="mt-4 flex gap-2">
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? t("console.saving") : t("console.create")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("console.noSchema")}</p>
          )}
        </div>

        {response && (
          <div className="mt-4 max-w-2xl">
            <pre className="rounded-md border bg-muted/30 p-3 text-xs overflow-auto max-h-[300px]">{response}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
