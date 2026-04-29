import { useState, memo } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Trash2 } from "lucide-react"
import { useEnvVars, type EnvVarScope } from "@/hooks/use-env-vars"
import type { EnvVarEntry } from "@/lib/db"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"

function EnvVarSection({
  disabled,
  onAdd,
  onRemove,
  onSet,
  scope,
  title,
  vars,
}: {
  disabled?: boolean
  onAdd: (scope: EnvVarScope, key: string, value: string) => void
  onRemove: (scope: EnvVarScope, key: string) => void
  onSet: (scope: EnvVarScope, key: string, value: string) => void
  scope: EnvVarScope
  title: string
  vars: EnvVarEntry[]
}) {
  const { t } = useTranslation()
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")

  const handleAdd = () => {
    const key = newKey.trim()
    if (!key || disabled) return
    onAdd(scope, key, newValue)
    setNewKey("")
    setNewValue("")
  }

  return (
    <FieldGroup className="gap-2">
      <div className="text-[11px] text-muted-foreground font-medium">
        {title}
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
            onChange={e => onSet(scope, v.key, e.target.value)}
            className="h-7 text-xs font-mono flex-1 min-w-0"
            placeholder={t("envVars.value")}
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onRemove(scope, v.key)}
            disabled={disabled}
          >
            <Trash2 />
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
          disabled={disabled}
        />
        <Input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          className="h-7 text-xs font-mono flex-1 min-w-0"
          placeholder={t("envVars.value")}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          disabled={disabled}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleAdd}
          disabled={!newKey.trim() || disabled}
        >
          <Plus />
        </Button>
      </div>
    </FieldGroup>
  )
}

export const EnvVarsPanel = memo(function EnvVarsPanel() {
  const { t } = useTranslation()
  const { documentVars, environmentVars, set, remove, activeEnvId } = useEnvVars()

  const handleSet = (scope: EnvVarScope, key: string, value: string) => {
    set(key, value, scope)
  }

  const handleRemove = (scope: EnvVarScope, key: string) => {
    remove(key, scope)
  }

  const handleAdd = (scope: EnvVarScope, key: string, value: string) => {
    set(key, value, scope)
  }

  return (
    <FieldGroup className="gap-4">
      <EnvVarSection
        scope="document"
        title={t("envVars.documentScope")}
        vars={documentVars}
        onSet={handleSet}
        onRemove={handleRemove}
        onAdd={handleAdd}
      />
      <EnvVarSection
        scope="environment"
        title={t("envVars.environmentScope")}
        vars={environmentVars}
        onSet={handleSet}
        onRemove={handleRemove}
        onAdd={handleAdd}
        disabled={!activeEnvId}
      />
      <div className="text-[10px] text-muted-foreground">
        {t("envVars.hint")}
      </div>
    </FieldGroup>
  )
})
