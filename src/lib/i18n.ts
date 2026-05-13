import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import zh_CN from "@/locales/zh_CN"
import zh_HK from "@/locales/zh_HK"
import zh_TW from "@/locales/zh_TW"
import en from "@/locales/en"
import ja from "@/locales/ja"
import ko from "@/locales/ko"

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: {
    zh_CN: { translation: zh_CN },
    zh_HK: { translation: zh_HK },
    zh_TW: { translation: zh_TW },
    en: { translation: en },
    ja: { translation: ja },
    ko: { translation: ko },
  },
  detection: {
    order: ["querystring", "localStorage", "navigator"],
    lookupQuerystring: "lang",
    lookupLocalStorage: "oa_locale",
    caches: ["localStorage"],
    convertDetectedLanguage: (lng: string) => {
      if (lng.startsWith("zh-TW")) return "zh_TW"
      if (lng.startsWith("zh-HK") || lng.startsWith("zh-Hant")) return "zh_HK"
      if (lng.startsWith("zh")) return "zh_CN"
      if (lng.startsWith("ja")) return "ja"
      if (lng.startsWith("ko")) return "ko"
      if (lng.startsWith("en")) return "en"
      return lng.replace("-", "_")
    },
  },
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export default i18n
