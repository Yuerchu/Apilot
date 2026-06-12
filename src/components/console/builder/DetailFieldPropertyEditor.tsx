import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { DetailFieldConfig } from "@/lib/console/types"

interface DetailFieldPropertyEditorProps {
  field: DetailFieldConfig
  onChange: (field: DetailFieldConfig) => void
}

export function DetailFieldPropertyEditor({ field, onChange }: DetailFieldPropertyEditorProps) {
  const update = (patch: Partial<DetailFieldConfig>) => onChange({ ...field, ...patch })

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="text-xs font-mono text-muted-foreground">{field.field}</div>

      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input
          value={field.label ?? ""}
          onChange={e => update({ label: e.target.value || undefined })}
          placeholder={field.field}
          className="h-8 text-xs"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Visible</Label>
        <Switch
          checked={field.visible}
          onCheckedChange={v => update({ visible: v })}
        />
      </div>
    </div>
  )
}
