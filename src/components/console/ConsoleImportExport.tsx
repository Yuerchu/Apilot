import { useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Download, Upload } from "lucide-react"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { exportApilotConfig, importApilotConfig, importLayouts, loadLayouts } from "@/lib/console/layout-config"
import { toast } from "sonner"

/**
 * Whole-spec .apilot export/import buttons (rendered in the sidebar console group header).
 */
export function ConsoleImportExport() {
  const { t } = useTranslation()
  const { state, dispatch, specId } = useConsoleContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasLayouts = Object.keys(state.layouts).length > 0

  const handleExport = useCallback(() => {
    const config = exportApilotConfig(state.layouts)
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "console-layouts.apilot"
    a.click()
    URL.revokeObjectURL(url)
  }, [state.layouts])

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const config = importApilotConfig(JSON.parse(text))
      if (!config) {
        toast.error(t("console.builder.importInvalid"))
        return
      }
      if (!specId) return
      await importLayouts(specId, config)
      const layouts = await loadLayouts(specId)
      dispatch({ type: "LOAD_LAYOUTS", layouts })
      toast.success(t("console.builder.importSuccess", { count: Object.keys(config.resources).length }))
    } catch {
      toast.error(t("console.builder.importInvalid"))
    }
  }, [specId, dispatch, t])

  return (
    <span className="ml-auto inline-flex items-center gap-0.5">
      {hasLayouts && (
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title={t("console.builder.exportAll")}
          onClick={e => { e.stopPropagation(); handleExport() }}
        >
          <Download className="size-3" />
        </button>
      )}
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        title={t("console.builder.import")}
        onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
      >
        <Upload className="size-3" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".apilot,.json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleImportFile(file)
          e.target.value = ""
        }}
      />
    </span>
  )
}
