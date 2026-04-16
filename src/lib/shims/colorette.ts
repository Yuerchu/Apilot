type Colorizer = (value: unknown) => string

const toString: Colorizer = value => String(value)

export const options = {
  enabled: false,
}

export const createColors = () => exported
export const isColorSupported = false

export const black = toString
export const red = toString
export const green = toString
export const yellow = toString
export const blue = toString
export const magenta = toString
export const cyan = toString
export const white = toString
export const gray = toString
export const grey = toString

export const bgBlack = toString
export const bgRed = toString
export const bgGreen = toString
export const bgYellow = toString
export const bgBlue = toString
export const bgMagenta = toString
export const bgCyan = toString
export const bgWhite = toString

export const dim = toString
export const bold = toString
export const hidden = toString
export const italic = toString
export const underline = toString
export const strikethrough = toString
export const reset = toString
export const inverse = toString

const exported = {
  options,
  createColors,
  isColorSupported,
  black,
  red,
  green,
  yellow,
  blue,
  magenta,
  cyan,
  white,
  gray,
  grey,
  bgBlack,
  bgRed,
  bgGreen,
  bgYellow,
  bgBlue,
  bgMagenta,
  bgCyan,
  bgWhite,
  dim,
  bold,
  hidden,
  italic,
  underline,
  strikethrough,
  reset,
  inverse,
}

export default exported
