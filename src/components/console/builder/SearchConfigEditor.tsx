import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SearchConfig } from "@/lib/console/types"

const AUTO = "__auto__"

interface SearchConfigEditorProps {
  config: SearchConfig | undefined
  candidateFields: string[]
  onChange: (config: SearchConfig) => void
}

function FieldSelect({ label, value, candidates, onChange }: {
  label: string
  value: string | undefined
  candidates: string[]
  onChange: (v: string | undefined) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select
        value={value ?? AUTO}
        onValueChange={v => onChange(v === AUTO ? undefined : v)}
      >
        <SelectTrigger className="h-8 text-xs w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO}>Auto</SelectItem>
          {candidates.map(f => (
            <SelectItem key={f} value={f}>{f}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function SearchConfigEditor({ config, candidateFields, onChange }: SearchConfigEditorProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4 p-3">
      <FieldSelect
        label={t("console.builder.titleField")}
        value={config?.titleField}
        candidates={candidateFields}
        onChange={v => onChange({ ...config, titleField: v })}
      />
      <FieldSelect
        label={t("console.builder.descField")}
        value={config?.descField}
        candidates={candidateFields}
        onChange={v => onChange({ ...config, descField: v })}
      />
    </div>
  )
}
