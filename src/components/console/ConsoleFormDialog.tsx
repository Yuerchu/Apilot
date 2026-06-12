import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import type { FormFieldConfig } from "@/lib/console/types"
import type { SchemaObject } from "@/lib/openapi/types"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

interface Props {
  resource: ConsoleResource
  mode: "create" | "edit"
  initialData?: Record<string, unknown> | undefined
  onSuccess: () => void
}

function applyFieldLayout(schema: SchemaObject, fieldConfigs: FormFieldConfig[] | undefined): SchemaObject {
  if (!fieldConfigs || fieldConfigs.length === 0 || !schema.properties) return schema
  const configMap = new Map(fieldConfigs.map(f => [f.field, f]))
  const visibleFields = fieldConfigs
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order)
    .map(f => f.field)
    .filter(f => f in schema.properties!)

  const newFields = Object.keys(schema.properties).filter(f => !configMap.has(f))
  const hiddenFields = new Set(
    fieldConfigs.filter(f => !f.visible).map(f => f.field),
  )

  const orderedKeys = [...visibleFields, ...newFields]
  const newProperties: Record<string, SchemaObject> = {}
  for (const key of orderedKeys) {
    if (schema.properties[key]) {
      const cfg = configMap.get(key)
      const prop = schema.properties[key]
      newProperties[key] = cfg?.label || cfg?.widgetType
        ? {
          ...prop,
          ...(cfg.label ? { title: cfg.label } : {}),
          ...(cfg.widgetType ? { "x-widget": cfg.widgetType } : {}),
        }
        : prop
    }
  }

  const result: SchemaObject = { ...schema, properties: newProperties }
  if (schema.required) {
    result.required = schema.required.filter(r => !hiddenFields.has(r))
  }
  return result
}

export function ConsoleFormDialog({ resource, mode, initialData, onSuccess }: Props) {
  const { t } = useTranslation()
  const { dispatch, activeLayout } = useConsoleContext()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [formData, setFormData] = useState<FormOutput>(initialData ?? {})

  const rawSchema = mode === "create" ? resource.createSchema : resource.updateSchema
  const fieldConfigs = mode === "create" ? activeLayout?.createFields : activeLayout?.updateFields
  const schema = useMemo(
    () => rawSchema ? applyFieldLayout(rawSchema, fieldConfigs) : null,
    [rawSchema, fieldConfigs],
  )
  const operation = mode === "create" ? resource.operations.create : resource.operations.update

  const close = () => dispatch({ type: "SET_SUB_VIEW", view: "list" })

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const handleSubmit = async () => {
    if (!operation) return
    const body = JSON.stringify(formData)
    const params: Record<string, string> = {}

    if (mode === "edit" && resource.idParam && initialData) {
      const id = String(initialData[resource.idParam] ?? initialData["id"] ?? "")
      if (id) params[resource.idParam] = id
    }

    const result = await sendRequest(operation.route, params, body, "application/json")
    if (result && result.status >= 200 && result.status < 300) {
      toast.success(mode === "create" ? t("console.created") : t("console.updated"))
      onSuccess()
      close()
    } else if (result) {
      const key = mode === "create" ? "console.createFailed" : "console.updateFailed"
      toast.error(t(key, { status: `${result.status} ${result.statusText}` }))
    }
  }

  const title = mode === "create"
    ? `${t("console.create")} ${resource.displayName}`
    : `${t("console.edit")} ${resource.displayName}`

  if (!schema) {
    return (
      <Dialog open onOpenChange={() => close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("console.noSchema")}</p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={() => close()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <SchemaForm
          schema={schema}
          value={formData}
          onChange={handleChange}
          defaultExcludeOptional={mode === "edit"}
        />
        <DialogFooter>
          <Button variant="outline" onClick={close}>{t("console.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t("console.saving") : (mode === "create" ? t("console.create") : t("console.save"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
