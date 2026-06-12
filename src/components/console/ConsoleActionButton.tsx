import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import type { ResourceAction } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { isDangerousAction } from "@/lib/console/template-utils"
import { ConfirmDialog } from "./ConfirmDialog"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function ConsoleActionButton({ action }: { action: ResourceAction }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { mutate, loading } = useConsoleFetch()
  const [formData, setFormData] = useState<FormOutput>({})

  const schema = getRequestBodySchema(action.route)
  const hasBody = !!schema
  const dangerous = isDangerousAction(action.route)

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const execute = async () => {
    const body = formData && Object.keys(formData).length > 0 ? JSON.stringify(formData) : ""
    const ok = await mutate(action.route, { body })
    if (ok) toast.success(`${action.label}: ${t("console.ok")}`)
    else toast.error(`${action.label}: ${t("console.requestFailed")}`)
    setOpen(false)
  }

  if (!hasBody) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() => dangerous ? setConfirmOpen(true) : execute()}
          disabled={loading}
        >
          <Play className="size-3 mr-1" />
          {action.label}
        </Button>
        {dangerous && (
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={action.label}
            description={t("console.confirmDangerous", { action: action.label })}
            confirmLabel={t("console.execute")}
            destructive
            onConfirm={() => { setConfirmOpen(false); execute() }}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Play className="size-3 mr-1" />
        {action.label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-w-lg max-h-[80vh] flex-col">
          <DialogHeader><DialogTitle>{action.label}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground font-mono">
            {action.route.method.toUpperCase()} {action.route.path}
          </p>
          {schema && (
            <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <SchemaForm schema={schema} value={formData} onChange={handleChange} />
            </div>
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
