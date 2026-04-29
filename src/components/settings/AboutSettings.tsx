import { useTranslation } from "react-i18next"
import { ApilotLogo } from "./ApilotLogo"
import { APP_VERSION, GIT_HASH, GIT_BRANCH, BUILD_TIME, IS_CI, CI_RUN_NUMBER, GITHUB_URL } from "@/lib/app-info"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export function AboutSettings() {
  const { t } = useTranslation()

  const buildLabel = IS_CI && CI_RUN_NUMBER ? `CI #${CI_RUN_NUMBER}` : t("settings.localBuild")

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <ApilotLogo size={80} />

      <div>
        <h2 className="text-xl font-semibold">Apilot</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.aboutDesc")}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <Badge variant="secondary">v{APP_VERSION}</Badge>
        {GIT_HASH && <Badge variant="outline" className="font-mono">{GIT_HASH}</Badge>}
        {GIT_BRANCH && <Badge variant="outline">{GIT_BRANCH}</Badge>}
        <Badge variant="outline">{buildLabel}</Badge>
      </div>

      <Separator />

      <div className="flex w-full max-w-xs flex-col gap-1 text-xs text-muted-foreground">
        {BUILD_TIME && (
          <div className="flex justify-between">
            <span>{t("settings.buildTime")}</span>
            <span className="font-mono">{new Date(BUILD_TIME).toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>{t("settings.license")}</span>
          <span>MIT</span>
        </div>
      </div>

      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub
      </a>
    </div>
  )
}
