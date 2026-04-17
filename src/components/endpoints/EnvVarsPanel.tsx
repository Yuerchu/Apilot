import { useState, memo } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Trash2 } from "lucide-react"
import { useEnvVars } from "@/hooks/use-env-vars"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export const EnvVarsPanel = memo(function EnvVarsPanel() {
  const { t } = useTranslation()
  const { vars, set, remove } = useEnvVars()
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")

  const handleAdd = () => {
    const key = newKey.trim()
    if (!key) return
    set(key, newValue)
    setNewKey("")
    setNewValue("")
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground font-medium">
        {t("envVars.title")}
      </div>
      {vars.map(v => (
        <div key={v.key} className="flex items-center gap-1.5">
          <Input
            value={v.key}
            readOnly
            className="h-7 text-xs font-mono flex-1 min-w-0 bg-muted/30"
          />
          <Input
            value={v.value}
            onChange={e => set(v.key, e.target.value)}
            className="h-7 text-xs font-mono flex-1 min-w-0"
            placeholder={t("envVars.value")}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => remove(v.key)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          className="h-7 text-xs font-mono flex-1 min-w-0"
          placeholder={t("envVars.keyPlaceholder")}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <Input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          className="h-7 text-xs font-mono flex-1 min-w-0"
          placeholder={t("envVars.value")}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleAdd}
          disabled={!newKey.trim()}
        >
          <Plus className="size-3" />
        </Button>
      </div>
      <div className="text-[10px] text-muted-foreground">
        {t("envVars.hint")}
      </div>
    </div>
  )
})
