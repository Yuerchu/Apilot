import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

interface Props {
  resource: ConsoleResource
  mode: "create" | "edit"
  initialData?: Record<string, unknown>
  onSuccess: () => void
}

export function ConsoleFormDialog({ resource, mode, initialData, onSuccess }: Props) {
  const { dispatch } = useConsoleContext()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [formData, setFormData] = useState<FormOutput>(initialData ?? {})

  const schema = mode === "create" ? resource.createSchema : resource.updateSchema
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
      toast.success(mode === "create" ? "Created" : "Updated")
      onSuccess()
      close()
    } else {
      toast.error(`${mode === "create" ? "Create" : "Update"} failed: ${result?.status} ${result?.statusText}`)
    }
  }

  if (!schema) {
    return (
      <Dialog open onOpenChange={() => close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create" : "Edit"} {resource.displayName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">No schema available for this operation.</p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={() => close()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create" : "Edit"} {resource.displayName}</DialogTitle>
        </DialogHeader>
        <SchemaForm
          schema={schema}
          value={formData}
          onChange={handleChange}
          defaultExcludeOptional={mode === "edit"}
        />
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : (mode === "create" ? "Create" : "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
