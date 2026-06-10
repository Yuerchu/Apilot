import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import type { ResourceAction } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function ConsoleActionButton({ action }: { action: ResourceAction }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { mutate, loading } = useConsoleFetch()
  const [formData, setFormData] = useState<FormOutput>({})

  const schema = getRequestBodySchema(action.route)
  const hasBody = !!schema

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const execute = async () => {
    const body = formData && Object.keys(formData).length > 0 ? JSON.stringify(formData) : ""
    const ok = await mutate(action.route, { body })
    if (ok) toast.success(`${action.label}: OK`)
    else toast.error(`${action.label}: failed`)
    setOpen(false)
  }

  if (!hasBody) {
    return (
      <Button size="sm" variant="outline" onClick={execute} disabled={loading}>
        <Play className="size-3 mr-1" />
        {action.label}
      </Button>
    )
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Play className="size-3 mr-1" />
        {action.label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{action.label}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground font-mono">
            {action.route.method.toUpperCase()} {action.route.path}
          </p>
          {schema && (
            <SchemaForm schema={schema} value={formData} onChange={handleChange} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("console.cancel")}</Button>
            <Button onClick={execute} disabled={loading}>
              {loading ? t("console.running") : t("console.execute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
