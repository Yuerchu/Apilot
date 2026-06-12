import { describe, it, expect } from "vitest"
import type { SchemaObject } from "@/lib/openapi"
import {
  resolveWidget,
  getExplicitWidget,
  detectOtpLength,
  isPhoneFormat,
  WIDGET_THRESHOLDS,
  IMPLEMENTED_WIDGETS,
  WIDGET_DEFS,
  type WidgetType,
} from "./resolve-widget"

const enumOf = (n: number): SchemaObject => ({
  type: "string",
  enum: Array.from({ length: n }, (_, i) => `v${i}`),
})

describe("resolveWidget", () => {
  const cases: [string, SchemaObject, WidgetType][] = [
    // enum
    ["enum with 2 values → radio", enumOf(2), "radio"],
    ["enum at toggle max → radio", enumOf(WIDGET_THRESHOLDS.enumToggleMax), "radio"],
    ["enum above toggle max → combobox", enumOf(WIDGET_THRESHOLDS.enumToggleMax + 1), "combobox"],
    ["integer enum → radio", { type: "integer", enum: [1, 2, 3] }, "radio"],
    // boolean
    ["boolean → switch", { type: "boolean" }, "switch"],
    ["nullable boolean (3.1 array type) → switch", { type: ["boolean", "null"] }, "switch"],
    // date / datetime
    ["date-time → datetime", { type: "string", format: "date-time" }, "datetime"],
    ["date → date", { type: "string", format: "date" }, "date"],
    // phone
    ["format phone → phone", { type: "string", format: "phone" }, "phone"],
    ["format e164 → phone", { type: "string", format: "e164" }, "phone"],
    ["format mobile → phone", { type: "string", format: "mobile" }, "phone"],
    // otp
    ["6-digit pattern → otp", { type: "string", pattern: "^\\d{6}$" }, "otp"],
    ["digit-class pattern → otp", { type: "string", pattern: "^[0-9]{4}$" }, "otp"],
    ["9-digit pattern → input (too long for otp)", { type: "string", pattern: "^\\d{9}$" }, "input"],
    ["integer code 0-999999 → otp", { type: "integer", minimum: 0, maximum: 999999 }, "otp"],
    // slider vs number
    ["bounded integer → slider", { type: "integer", minimum: 1, maximum: 100 }, "slider"],
    ["bounded integer with multipleOf → slider", { type: "integer", minimum: 0, maximum: 10000, multipleOf: 100 }, "slider"],
    ["bounded integer too many steps → number", { type: "integer", minimum: 0, maximum: 10000 }, "number"],
    ["bounded integer single step → number", { type: "integer", minimum: 0, maximum: 1 }, "number"],
    ["unbounded integer → number", { type: "integer" }, "number"],
    ["integer with only minimum → number", { type: "integer", minimum: 0 }, "number"],
    ["bounded float without multipleOf → number", { type: "number", minimum: 0, maximum: 1 }, "number"],
    ["bounded float with multipleOf → slider", { type: "number", minimum: 0, maximum: 1, multipleOf: 0.1 }, "slider"],
    ["inverted range → number", { type: "integer", minimum: 10, maximum: 5 }, "number"],
    // string formats
    ["password → password", { type: "string", format: "password" }, "password"],
    ["email → email", { type: "string", format: "email" }, "email"],
    ["uri → url", { type: "string", format: "uri" }, "url"],
    ["url → url", { type: "string", format: "url" }, "url"],
    // textarea
    ["long string → textarea", { type: "string", maxLength: WIDGET_THRESHOLDS.textareaMinLength + 1 }, "textarea"],
    ["string at textarea threshold → input", { type: "string", maxLength: WIDGET_THRESHOLDS.textareaMinLength }, "input"],
    // fallback
    ["plain string → input", { type: "string" }, "input"],
    ["untyped → input", {}, "input"],
    ["uuid string → input", { type: "string", format: "uuid" }, "input"],
  ]

  it.each(cases)("%s", (_name, schema, expected) => {
    expect(resolveWidget(schema)).toBe(expected)
  })

  it("resolves through allOf merge", () => {
    const schema: SchemaObject = { allOf: [{ type: "string" }, { enum: ["a", "b"] }] }
    expect(resolveWidget(schema)).toBe("radio")
  })

  it("resolves nullable anyOf wrapper", () => {
    const schema: SchemaObject = { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
    expect(resolveWidget(schema)).toBe("datetime")
  })

  it("enum wins over format", () => {
    expect(resolveWidget({ type: "string", format: "email", enum: ["a@x.com", "b@x.com"] })).toBe("radio")
  })
})

describe("getExplicitWidget", () => {
  it("returns a valid x-widget", () => {
    expect(getExplicitWidget({ type: "string", "x-widget": "textarea" })).toBe("textarea")
  })
  it("rejects unknown values", () => {
    expect(getExplicitWidget({ type: "string", "x-widget": "fancy" })).toBeUndefined()
  })
  it("returns undefined when absent", () => {
    expect(getExplicitWidget({ type: "string" })).toBeUndefined()
  })
  it("every WIDGET_DEFS value round-trips", () => {
    for (const def of WIDGET_DEFS) {
      expect(getExplicitWidget({ "x-widget": def.value })).toBe(def.value)
    }
  })
})

describe("detectOtpLength", () => {
  it("exact digit pattern", () => {
    expect(detectOtpLength({ type: "string", pattern: "^\\d{6}$" })).toBe(6)
  })
  it("range digit pattern uses max", () => {
    expect(detectOtpLength({ type: "string", pattern: "^\\d{4,6}$" })).toBe(6)
  })
  it("non-digit pattern → null", () => {
    expect(detectOtpLength({ type: "string", pattern: "^[a-z]+$" })).toBeNull()
  })
  it("integer power-of-ten max", () => {
    expect(detectOtpLength({ type: "integer", maximum: 9999 })).toBe(4)
  })
  it("integer non-power max → null", () => {
    expect(detectOtpLength({ type: "integer", maximum: 5000 })).toBeNull()
  })
})

describe("isPhoneFormat", () => {
  it.each(["phone", "telephone", "mobile", "e164", "e.164"])("format %s", fmt => {
    expect(isPhoneFormat({ type: "string", format: fmt })).toBe(true)
  })
  it("plain string is not phone", () => {
    expect(isPhoneFormat({ type: "string" })).toBe(false)
  })
})

describe("IMPLEMENTED_WIDGETS", () => {
  it("only contains known widget values", () => {
    const known = new Set(WIDGET_DEFS.map(d => d.value))
    for (const w of IMPLEMENTED_WIDGETS) expect(known.has(w)).toBe(true)
  })
  it("auto-inference only produces implemented widgets", () => {
    const samples: SchemaObject[] = [
      enumOf(3), enumOf(20), { type: "boolean" },
      { type: "string", format: "date-time" }, { type: "string", format: "date" },
      { type: "string", format: "phone" }, { type: "string", pattern: "^\\d{6}$" },
      { type: "integer", minimum: 1, maximum: 100 }, { type: "integer" },
      { type: "string", format: "password" }, { type: "string", format: "email" },
      { type: "string", format: "uri" }, { type: "string", maxLength: 1000 }, { type: "string" },
    ]
    for (const s of samples) expect(IMPLEMENTED_WIDGETS.has(resolveWidget(s))).toBe(true)
  })
})
