import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { registerSW } from "virtual:pwa-register"
import "@/lib/i18n"
import i18n from "@/lib/i18n"
import App from "./App"
import "./index.css"

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    const msg = i18n.t("app.updateAvailable", "New version available. Reload to update?")
    if (confirm(msg)) {
      void updateSW(true)
    }
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="oa_theme">
      <App />
      <Toaster position="bottom-left" />
    </ThemeProvider>
  </StrictMode>,
)
