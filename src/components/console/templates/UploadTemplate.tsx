import { useState, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Upload, FileUp, X, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useConsoleFetch } from "@/hooks/use-console-fetch"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { findBinaryFieldName } from "@/lib/console/template-utils"
import { ConsoleActionButton } from "../ConsoleActionButton"
import { toast } from "sonner"
import type { TemplateProps } from "./index"

type FileStatus = "pending" | "uploading" | "done" | "failed"

export function UploadTemplate({ resource }: TemplateProps) {
  const { t } = useTranslation()
  const { mutateWithResponse, loading } = useConsoleFetch()
  const [files, setFiles] = useState<File[]>([])
  const [statuses, setStatuses] = useState<Record<number, FileStatus>>({})
  const [response, setResponse] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const action = resource.actions[0] ?? resource.operations.create
  const route = action?.route

  // The multipart field name comes from the schema's binary property, not a guess
  const fileFieldName = useMemo(() => {
    const schema = route ? getRequestBodySchema(route) : null
    return findBinaryFieldName(schema) ?? "file"
  }, [route])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length > 0) { setFiles(prev => [...prev, ...dropped]); setStatuses({}) }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length > 0) { setFiles(prev => [...prev, ...selected]); setStatuses({}) }
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setStatuses({})
  }, [])

  const handleUpload = async () => {
    if (!route || files.length === 0) return
    let anyFailed = false
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      setStatuses(prev => ({ ...prev, [i]: "uploading" }))
      const { ok, response: resp } = await mutateWithResponse(route, {
        contentType: "multipart/form-data",
        formData: { [fileFieldName]: file },
      })
      setStatuses(prev => ({ ...prev, [i]: ok ? "done" : "failed" }))
      setResponse(resp || null)
      if (ok) toast.success(`${file.name}: ${t("console.uploadStatus.done")}`)
      else { toast.error(`${file.name}: ${t("console.uploadStatus.failed")}`); anyFailed = true }
    }
    if (!anyFailed) {
      setFiles([])
      setStatuses({})
    }
  }

  const statusIcon = (status: FileStatus | undefined) => {
    switch (status) {
      case "uploading": return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      case "done": return <CheckCircle2 className="size-3.5 text-emerald-500" />
      case "failed": return <XCircle className="size-3.5 text-destructive" />
      default: return null
    }
  }

  return (
    <div className="flex items-start justify-center py-8 h-full overflow-auto">
      <div className="w-full max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{resource.displayName}</CardTitle>
            <CardDescription className="font-mono text-xs">{resource.basePath}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => inputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
              `}
            >
              <Upload className="size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {t("console.dropFilesHint")}
              </p>
              <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <FileUp className="size-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    {statusIcon(statuses[i])}
                    {!loading && (
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <Button onClick={handleUpload} disabled={loading} className="w-full mt-2">
                  {loading ? t("console.uploadStatus.uploading") : t("console.uploadCount", { count: files.length })}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {resource.actions.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {resource.actions.slice(1).map((a, i) => (
              <ConsoleActionButton key={i} action={a} />
            ))}
          </div>
        )}

        {response && (
          <Card>
            <CardContent className="pt-4">
              <pre className="rounded-md border bg-muted/30 p-3 text-xs overflow-auto max-h-[200px]">{response}</pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
