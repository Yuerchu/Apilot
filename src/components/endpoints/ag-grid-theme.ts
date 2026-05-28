import { themeQuartz, colorSchemeDarkWarm, colorSchemeLight } from "ag-grid-community"

const sharedParams = {
  borderRadius: 0,
  wrapperBorderRadius: 0,
  fontSize: 12,
  headerFontSize: 11,
  cellVerticalPaddingScale: 0.6,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
}

export const agGridDarkTheme = themeQuartz.withPart(colorSchemeDarkWarm).withParams({
  ...sharedParams,
  backgroundColor: "transparent",
  headerBackgroundColor: "oklch(0.269 0 0 / 0.3)",
  rowHoverColor: "oklch(0.269 0 0 / 0.3)",
})

export const agGridLightTheme = themeQuartz.withPart(colorSchemeLight).withParams({
  ...sharedParams,
  backgroundColor: "transparent",
  headerBackgroundColor: "oklch(0.269 0 0 / 0.05)",
  rowHoverColor: "oklch(0.269 0 0 / 0.05)",
})
