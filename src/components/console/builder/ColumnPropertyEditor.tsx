import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ColumnConfig } from "@/lib/console/types"

interface ColumnPropertyEditorProps {
  column: ColumnConfig
  onChange: (column: ColumnConfig) => void
}

export function ColumnPropertyEditor({ column, onChange }: ColumnPropertyEditorProps) {
  const { t } = useTranslation()

  const update = (patch: Partial<ColumnConfig>) => onChange({ ...column, ...patch })

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="text-xs font-mono text-muted-foreground">{column.field}</div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("console.edit")}</Label>
        <Input
          value={column.headerLabel ?? ""}
          onChange={e => update({ headerLabel: e.target.value || undefined })}
          placeholder={column.field}
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Width (px)</Label>
        <Input
          type="number"
          value={column.width ?? ""}
          onChange={e => update({ width: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="auto"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Pin</Label>
        <ToggleGroup
          type="single"
          value={column.pinned ?? "none"}
          onValueChange={v => update({ pinned: v === "left" || v === "right" ? v : undefined })}
          className="justify-start"
        >
          <ToggleGroupItem value="left" className="text-xs h-7 px-2">Left</ToggleGroupItem>
          <ToggleGroupItem value="none" className="text-xs h-7 px-2">None</ToggleGroupItem>
          <ToggleGroupItem value="right" className="text-xs h-7 px-2">Right</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">{t("console.actions")}</Label>
        <Switch
          checked={column.visible}
          onCheckedChange={v => update({ visible: v })}
        />
      </div>
    </div>
  )
}
