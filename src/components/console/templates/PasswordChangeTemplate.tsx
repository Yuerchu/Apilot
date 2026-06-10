import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Lock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function PasswordChangeTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [formData, setFormData] = useState<FormOutput>({})
  const [success, setSuccess] = useState(false)

  const action = resource.actions[0] ?? resource.operations.create ?? resource.operations.update
  const schema = action ? getRequestBodySchema(action.route) : (resource.createSchema ?? resource.updateSchema)

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    if (!action) return
    const body = JSON.stringify(formData)
    const result = await sendRequest(action.route, {}, body, "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        toast.success(t("console.updated"))
        setSuccess(true)
        setFormData({})
      } else {
        toast.error(t("console.updateFailed", { status: `${result.status} ${result.statusText}` }))
      }
    }
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
          <CardFooter>
            <Button onClick={handleSubmit} disabled={loading || !schema} className="w-full">
              {loading ? t("console.saving") : t("console.save")}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
