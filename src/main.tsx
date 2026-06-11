import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { registerSW } from "virtual:pwa-register"
import { toast } from "sonner"
import "@/lib/i18n"
import i18n from "@/lib/i18n"
import App from "./App"
import "./index.css"

const updateSW = registerSW({
  onNeedRefresh() {
    toast.info(i18n.t("app.updateAvailable", "A new version is available"), {
      description: i18n.t("app.updateAvailableDesc", "Reload to get the latest features and fixes."),
      duration: Infinity,
      action: {
        label: i18n.t("app.updateNow", "Update now"),
        onClick: () => void updateSW(true),
      },
    })
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="oa_theme">
      <App />
      <Toaster position="top-center" />
    </ThemeProvider>
  </StrictMode>,
)
