import { useState, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Upload, FileUp, X } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useRequest } from "@/hooks/use-request"
import { useAuthContext } from "@/contexts/AuthContext"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleActionButton } from "../ConsoleActionButton"
import { toast } from "sonner"

export function UploadTemplate({ resource }: { resource: ConsoleResource }) {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { sendRequest, loading } = useRequest(auth.getAuthHeaders)
  const [files, setFiles] = useState<File[]>([])
  const [response, setResponse] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const action = resource.actions[0] ?? resource.operations.create
  const route = action?.route

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length > 0) setFiles(prev => [...prev, ...dropped])
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length > 0) setFiles(prev => [...prev, ...selected])
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpload = async () => {
    if (!route || files.length === 0) return
    for (const file of files) {
      const formData = new FormData()
      formData.append("file", file)
      const result = await sendRequest(route, {}, "", "multipart/form-data", { file })
      if (result) {
        if (result.status >= 200 && result.status < 300) {
          toast.success(`${file.name}: ${result.status}`)
          try { setResponse(JSON.stringify(JSON.parse(result.body), null, 2)) } catch { setResponse(result.body) }
        } else {
          toast.error(`${file.name}: ${result.status} ${result.statusText}`)
        }
      }
    }
    setFiles([])
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
                Drop files here or click to browse
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
                    <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <Button onClick={handleUpload} disabled={loading} className="w-full mt-2">
                  {loading ? t("console.saving") : `Upload ${files.length} file(s)`}
                </Button>
              </div>
            )}

            {loading && <Progress className="mt-4" />}
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
