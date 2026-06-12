import * as React from "react"
import { useTranslation } from "react-i18next"
import { Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FilePickerProps {
  file?: File | null
  onChange: (file: File | null) => void
  accept?: string
  className?: string
}

/** shadcn-style file picker: hidden native input triggered by a Button, no native control UI */
export function FilePicker({ file, onChange, accept, className }: FilePickerProps) {
  const { t } = useTranslation()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleClear = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        {...(accept ? { accept } : {})}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        {t("tryIt.chooseFile", "Choose file")}
      </Button>
      {file && (
        <>
          <span className="truncate text-xs text-muted-foreground" title={file.name}>{file.name}</span>
          <Button variant="ghost" size="icon" className="size-6 shrink-0" type="button" onClick={handleClear}>
            <X className="size-3" />
          </Button>
        </>
      )}
    </div>
  )
}
