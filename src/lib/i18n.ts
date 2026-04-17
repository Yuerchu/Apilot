import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import zh_CN from "@/locales/zh_CN"
import zh_HK from "@/locales/zh_HK"
import zh_TW from "@/locales/zh_TW"
import en from "@/locales/en"
import ja from "@/locales/ja"
import ko from "@/locales/ko"

// Read saved language or detect from URL params
const params = new URLSearchParams(window.location.search)
const savedLang = params.get("lang") || localStorage.getItem("oa_locale") || "zh_CN"

i18n.use(initReactI18next).init({
  resources: {
    zh_CN: { translation: zh_CN },
    zh_HK: { translation: zh_HK },
    zh_TW: { translation: zh_TW },
    en: { translation: en },
    ja: { translation: ja },
    ko: { translation: ko },
  },
  lng: savedLang,
  fallbackLng: "zh_CN",
  interpolation: { escapeValue: false },
})

// Persist language changes
i18n.on("languageChanged", (lng) => {
  localStorage.setItem("oa_locale", lng)
})

export default i18n
