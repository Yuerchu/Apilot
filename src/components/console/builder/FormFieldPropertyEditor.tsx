import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FormFieldConfig } from "@/lib/console/types"
import { WIDGET_DEFS } from "@/lib/resolve-widget"

const WIDGET_TYPES = [{ value: "", label: "Auto" }, ...WIDGET_DEFS]

interface FormFieldPropertyEditorProps {
  field: FormFieldConfig
  onChange: (field: FormFieldConfig) => void
}

export function FormFieldPropertyEditor({ field, onChange }: FormFieldPropertyEditorProps) {
  const update = (patch: Partial<FormFieldConfig>) => onChange({ ...field, ...patch })

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

      <div className="space-y-1.5">
        <Label className="text-xs">Widget</Label>
        <Select
          value={field.widgetType ?? "__auto__"}
          onValueChange={v => update({ widgetType: v === "__auto__" ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Auto" />
          </SelectTrigger>
          <SelectContent>
            {WIDGET_TYPES.map(w => (
              <SelectItem key={w.value || "__auto__"} value={w.value || "__auto__"}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
