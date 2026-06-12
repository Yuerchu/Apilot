import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { StatsConfig } from "@/lib/console/types"

const CHART_TYPES = ["bar", "line", "area"] as const

interface StatsConfigEditorProps {
  config: StatsConfig | undefined
  candidateFields: string[]
  onChange: (config: StatsConfig) => void
}

export function StatsConfigEditor({ config, candidateFields, onChange }: StatsConfigEditorProps) {
  const { t } = useTranslation()
  const excluded = new Set(config?.excludeFields ?? [])

  const toggleField = (field: string) => {
    const next = new Set(excluded)
    if (next.has(field)) next.delete(field)
    else next.add(field)
    onChange({ ...config, excludeFields: next.size > 0 ? [...next] : undefined })
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("console.builder.chartType")}</Label>
        <Select
          value={config?.chartType ?? "bar"}
          onValueChange={v => onChange({ ...config, chartType: v as StatsConfig["chartType"] })}
        >
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_TYPES.map(ct => (
              <SelectItem key={ct} value={ct}>{ct}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("console.builder.chartHeight")}</Label>
        <Input
          type="number"
          value={config?.chartHeight ?? 300}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            onChange({ ...config, chartHeight: Number.isFinite(n) && n > 0 ? n : undefined })
          }}
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("console.builder.refreshInterval")}</Label>
        <Input
          type="number"
          value={config?.refreshInterval ?? 0}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            onChange({ ...config, refreshInterval: Number.isFinite(n) && n > 0 ? n : undefined })
          }}
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">{t("console.builder.refreshIntervalHint")}</p>
      </div>

      {candidateFields.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t("console.builder.excludeFields")}</Label>
          <div className="flex flex-col gap-1.5">
            {candidateFields.map(field => (
              <div key={field} className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono truncate">{field}</span>
                <Switch
                  checked={!excluded.has(field)}
                  onCheckedChange={() => toggleField(field)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
