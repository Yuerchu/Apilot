import { useTranslation } from "react-i18next"
import { useTheme } from "next-themes"
import i18n from "@/lib/i18n"
import { Sun, Moon, Monitor, Sparkles, Leaf } from "lucide-react"
import { useMotionPreference, type MotionPreference } from "@/hooks/use-reduced-motion"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const LANGUAGES = [
  { value: "zh_CN", label: "简体中文" },
  { value: "zh_HK", label: "繁體中文（港）" },
  { value: "zh_TW", label: "繁體中文（臺）" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
] as const

const THEME_CYCLE = ["system", "light", "dark"] as const
const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const

const MOTION_CYCLE: MotionPreference[] = ["system", "always", "reduced"]
const MOTION_ICONS = { system: Monitor, always: Sparkles, reduced: Leaf } as const
const THEME_LABELS: Record<string, Record<string, string>> = {
  zh_CN: { system: "跟随系统", light: "浅色", dark: "深色" },
  zh_HK: { system: "跟隨系統", light: "淺色", dark: "深色" },
  zh_TW: { system: "跟隨系統", light: "淺色", dark: "深色" },
  en: { system: "System", light: "Light", dark: "Dark" },
  ja: { system: "システム", light: "ライト", dark: "ダーク" },
  ko: { system: "시스템", light: "라이트", dark: "다크" },
}

export function GeneralSettings() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const [motionPref, setMotionPref] = useMotionPreference()
  const current = theme ?? "system"
  const labels = THEME_LABELS[i18n.language] ?? THEME_LABELS.en

  return (
    <FieldGroup className="gap-6">
      <Field>
        <FieldLabel htmlFor="settings-language">{t("settings.language")}</FieldLabel>
        <Select value={i18n.language} onValueChange={v => i18n.changeLanguage(v)}>
          <SelectTrigger id="settings-language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(lang => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel id="label-theme">{t("settings.theme")}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={current}
          onValueChange={v => { if (v) setTheme(v) }}
          className="justify-start"
          aria-labelledby="label-theme"
        >
          {THEME_CYCLE.map(t => {
            const Icon = THEME_ICONS[t]
            return (
              <ToggleGroupItem key={t} value={t} className="gap-2 px-3">
                <Icon className="size-4" />
                {labels?.[t] ?? t}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel id="label-motion">{t("settings.motion")}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={motionPref}
          onValueChange={v => { if (v) setMotionPref(v as MotionPreference) }}
          className="justify-start"
          aria-labelledby="label-motion"
        >
          {MOTION_CYCLE.map(m => {
            const Icon = MOTION_ICONS[m]
            return (
              <ToggleGroupItem key={m} value={m} className="gap-2 px-3">
                <Icon className="size-4" />
                {t(`settings.motion${m.charAt(0).toUpperCase()}${m.slice(1)}` as "settings.motionSystem")}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </Field>
    </FieldGroup>
  )
}
