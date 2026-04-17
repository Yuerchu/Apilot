import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Settings, Link, Shield, Variable } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { GeneralSettings } from "./GeneralSettings"
import { ConnectionSettings } from "./ConnectionSettings"
import { AuthSettings } from "./AuthSettings"
import { EnvVarsSettings } from "./EnvVarsSettings"

type SettingsTab = "general" | "connection" | "auth" | "envVars"

const TABS: { id: SettingsTab; icon: typeof Settings; labelKey: string }[] = [
  { id: "general", icon: Settings, labelKey: "settings.general" },
  { id: "connection", icon: Link, labelKey: "settings.connection" },
  { id: "auth", icon: Shield, labelKey: "settings.auth" },
  { id: "envVars", icon: Variable, labelKey: "settings.envVars" },
]

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] max-h-[600px] p-0 gap-0 flex flex-col sm:flex-row overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.title")}</DialogDescription>
        </DialogHeader>

        {/* Left nav */}
        <nav className="w-full sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r p-2 sm:p-3 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="size-4 shrink-0" />
                {t(tab.labelKey)}
              </button>
            )
          })}
        </nav>

        {/* Right content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "connection" && <ConnectionSettings />}
          {activeTab === "auth" && <AuthSettings />}
          {activeTab === "envVars" && <EnvVarsSettings />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
