import { useState, useCallback } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SchemaForm } from "@/components/schema/SchemaForm"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ResourceAction } from "@/lib/console/types"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { toast } from "sonner"

type FormOutput = Record<string, unknown> | unknown[]

export function ConsoleActionButton({ action }: { action: ResourceAction }) {
  const [open, setOpen] = useState(false)
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [formData, setFormData] = useState<FormOutput>({})

  const schema = getRequestBodySchema(action.route)
  const hasBody = !!schema

  const handleChange = useCallback((v: FormOutput) => setFormData(v), [])

  const execute = async () => {
    const body = formData && Object.keys(formData).length > 0 ? JSON.stringify(formData) : ""
    const result = await sendRequest(action.route, {}, body, "application/json")
    if (result) {
      if (result.status >= 200 && result.status < 300) {
        toast.success(`${action.label}: ${result.status} ${result.statusText}`)
      } else {
        toast.error(`${action.label}: ${result.status} ${result.statusText}`)
      }
    }
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
          <DialogHeader>
            <DialogTitle>{action.label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground font-mono">
            {action.route.method.toUpperCase()} {action.route.path}
          </p>
          {schema && (
            <SchemaForm schema={schema} value={formData} onChange={handleChange} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={execute} disabled={loading}>
              {loading ? "Running..." : "Execute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
