import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import zh from "@/locales/zh"
import en from "@/locales/en"

// Read saved language or detect from URL params
const params = new URLSearchParams(window.location.search)
const savedLang = params.get("lang") || localStorage.getItem("oa_locale") || "zh"

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
})

// Persist language changes
i18n.on("languageChanged", (lng) => {
  localStorage.setItem("oa_locale", lng)
})

export default i18n
