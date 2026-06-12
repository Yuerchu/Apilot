import type { SchemaObject } from "@/lib/openapi"
import { resolveEffectiveSchema } from "@/lib/openapi"

/**
 * Widget identifiers shared between the console builder (FormFieldConfig.widgetType)
 * and the schema form renderer (SchemaInput).
 *
 * Rendering conventions:
 * - "radio"  → segmented ToggleGroup (single-choice tabs, deselect to clear)
 * - "select" → native Select dropdown (only via explicit x-widget; auto-inference
 *              produces "radio" or "combobox" instead)
 * - "switch" → true/false segmented ToggleGroup (deselect = unset)
 */
export type WidgetType =
  | "input"
  | "textarea"
  | "number"
  | "password"
  | "email"
  | "url"
  | "phone"
  | "select"
  | "combobox"
  | "checkbox"
  | "switch"
  | "radio"
  | "slider"
  | "date"
  | "datetime"
  | "file"
  | "color"
  | "otp"

/** Single source of truth for builder widget pickers (the "Auto" entry is added by the editor). */
export const WIDGET_DEFS: { value: WidgetType; label: string }[] = [
  { value: "input", label: "Input" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Select" },
  { value: "combobox", label: "Combobox" },
  { value: "switch", label: "Switch" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio Group" },
  { value: "slider", label: "Slider" },
  { value: "date", label: "Date Picker" },
  { value: "datetime", label: "DateTime Picker" },
  { value: "number", label: "Number Input" },
  { value: "password", label: "Password" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone" },
  { value: "otp", label: "OTP" },
  { value: "file", label: "File Upload" },
  { value: "color", label: "Color" },
]

const WIDGET_VALUES = new Set<string>(WIDGET_DEFS.map(w => w.value))

export const WIDGET_THRESHOLDS = {
  /** enum length ≤ this → segmented ToggleGroup; above → searchable combobox */
  enumToggleMax: 10,
  /** string maxLength > this → textarea */
  textareaMinLength: 256,
  /** slider needs a bounded range with a step count inside [min, max] */
  sliderMinSteps: 2,
  sliderMaxSteps: 1000,
} as const

/**
 * Widgets SchemaInput can actually render. An explicit x-widget outside this set
 * falls back to auto-inference instead of breaking the field.
 */
export const IMPLEMENTED_WIDGETS: Set<WidgetType> = new Set([
  "input",
  "textarea",
  "number",
  "password",
  "email",
  "url",
  "phone",
  "select",
  "combobox",
  "switch",
  "radio",
  "slider",
  "date",
  "datetime",
  "otp",
])

/** Read an explicit widget override from the schema (injected from builder FormFieldConfig). */
export function getExplicitWidget(schema: SchemaObject): WidgetType | undefined {
  const w = schema["x-widget"]
  return typeof w === "string" && WIDGET_VALUES.has(w) ? (w as WidgetType) : undefined
}

export function isPhoneFormat(schema: SchemaObject): boolean {
  const ps = resolveEffectiveSchema(schema)
  const fmt = ps.format
  return fmt === "phone" || fmt === "telephone" || fmt === "mobile" || fmt === "e164" || fmt === "e.164"
}

export function detectOtpLength(schema: SchemaObject): number | null {
  const ps = resolveEffectiveSchema(schema)
  const type = Array.isArray(ps.type) ? ps.type[0] : ps.type

  if (type === "string" || !type) {
    if (!ps.pattern) return null
    const exact = ps.pattern.match(/^\^(?:\\d|\[0-9\])\{(\d+)\}\$$/)
    if (exact) {
      const len = parseInt(exact[1]!, 10)
      return len <= 8 ? len : null
    }
    const range = ps.pattern.match(/^\^(?:\\d|\[0-9\])\{(\d+),(\d+)\}\$$/)
    if (range) {
      const max = parseInt(range[2]!, 10)
      return max <= 8 ? max : null
    }
    return null
  }

  if (type === "integer") {
    const max = ps.maximum
    if (max === undefined || max < 0) return null
    const str = (max + 1).toString()
    if (/^10+$/.test(str)) {
      const digits = str.length - 1
      if (digits >= 2 && digits <= 8) return digits
    }
    return null
  }

  return null
}

/**
 * Infer the widget for a schema. Rules apply top-down, first match wins.
 * Accepts raw or already-resolved schemas (resolveEffectiveSchema is idempotent).
 */
export function resolveWidget(schema: SchemaObject): WidgetType {
  const ps = resolveEffectiveSchema(schema)
  const type = Array.isArray(ps.type) ? ps.type[0] : ps.type

  if (ps.enum) {
    return ps.enum.length <= WIDGET_THRESHOLDS.enumToggleMax ? "radio" : "combobox"
  }
  if (type === "boolean") return "switch"
  if (ps.format === "date-time") return "datetime"
  if (ps.format === "date") return "date"
  if (isPhoneFormat(ps)) return "phone"
  if (detectOtpLength(ps) !== null) return "otp"

  if (type === "integer" || type === "number") {
    const { minimum: min, maximum: max } = ps
    if (min !== undefined && max !== undefined && max > min) {
      // Integers slide in whole steps by default; floats only when multipleOf is given,
      // so arbitrary float ranges don't surprise-render as sliders.
      const step = type === "integer" ? (ps.multipleOf ?? 1) : ps.multipleOf
      if (step) {
        const steps = (max - min) / step
        if (steps >= WIDGET_THRESHOLDS.sliderMinSteps && steps <= WIDGET_THRESHOLDS.sliderMaxSteps) {
          return "slider"
        }
      }
    }
    return "number"
  }

  if (ps.format === "password") return "password"
  if (ps.format === "email") return "email"
  if (ps.format === "uri" || ps.format === "url") return "url"
  if ((type === "string" || !type) && ps.maxLength !== undefined && ps.maxLength > WIDGET_THRESHOLDS.textareaMinLength) {
    return "textarea"
  }
  return "input"
}
