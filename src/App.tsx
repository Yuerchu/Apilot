import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { OpenAPIProvider, useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useSettings } from "@/hooks/use-settings"
import { useUrlState } from "@/hooks/use-url-state"
import { motion } from "motion/react"
import { Upload } from "lucide-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { openSettings } from "@/components/settings/SettingsDialog"
import { Fade } from "@/components/animate-ui/primitives/effects/fade"
import { formatMarkdown } from "@/lib/format-route"
import { Header } from "@/components/layout/Header"
import { Skeleton } from "@/components/ui/skeleton"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SelectionFab } from "@/components/layout/SelectionFab"
import { EndpointsView } from "@/components/endpoints/EndpointsView"
import { FavoritesView } from "@/components/endpoints/FavoritesView"
import { ModelsView } from "@/components/models/ModelsView"
import { SchemaViewerView } from "@/components/schema/SchemaViewerView"
import { OpenAPIDiagnosticsView, OpenAPIDiffView } from "@/components/tools/ProjectToolsView"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { toast } from "sonner"
import { ShareProvider } from "@/components/share/ShareDialog"
import { FavoritesContext, useFavoritesProvider } from "@/hooks/use-favorites"
import { EnvironmentsContext, useEnvironmentsProvider } from "@/hooks/use-environments"

export default function App() {
  return (
    <OpenAPIProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </OpenAPIProvider>
  )
}

function AppInner() {
  const environmentsValue = useEnvironmentsProvider()
  const favoritesValue = useFavoritesProvider()
  return (
    <EnvironmentsContext.Provider value={environmentsValue}>
      <FavoritesContext.Provider value={favoritesValue}>
        <AppContent />
      </FavoritesContext.Provider>
    </EnvironmentsContext.Provider>
  )
}

function AppContent() {
  const { t } = useTranslation()
  const {
    state,
    clearRouteSelection,
    clearModelSelection,
  } = useOpenAPIContext()
  const { loadFromUrl } = useOpenAPI()
  const auth = useAuthContext()
  useUrlState()

  useSettings({
    authType: auth.authType,
    authToken: auth.authToken,
    authUser: auth.authUser,
    authKeyName: auth.authKeyName,
    oauth2Token: auth.oauth2Token,
    setAuthType: auth.setAuthType,
    setAuthToken: auth.setAuthToken,
    setAuthUser: auth.setAuthUser,
    setAuthKeyName: auth.setAuthKeyName,
    setOAuth2Token: auth.setOAuth2Token,
  }, loadFromUrl)

  const isEmbedded = useMemo(() => !!window.__OPENAPI_URL__, [])

  useEffect(() => {
    if (window.__OPENAPI_URL__) {
      loadFromUrl(window.__OPENAPI_URL__)
      if (window.__OPENAPI_TITLE__) document.title = window.__OPENAPI_TITLE__
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const specLoaded = !!state.spec

  const handleCopyEndpoints = () => {
    const selected = state.routes.filter((_, i) => state.selectedRoutes.has(i))
    if (!selected.length) return
    const text = selected.map(r => formatMarkdown(r, false)).join("\n---\n\n")
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t("toast.copiedRoutes", { count: selected.length }))
    })
  }

  const handleCopyModels = () => {
    if (state.selectedModels.size === 0) return
    const schemas = state.spec?.components?.schemas || state.spec?.definitions || {}
    const parts: string[] = []
    for (const name of state.selectedModels) {
      const schema = schemas[name]
      if (!schema) continue
      parts.push(`## ${name}\n${schema.description || ""}\n`)
    }
    navigator.clipboard.writeText(parts.join("\n---\n\n")).then(() => {
      toast.success(t("toast.copiedModels", { count: state.selectedModels.size }))
    })
  }

  return (
    <ShareProvider>
      <SidebarProvider defaultOpen={!isEmbedded}>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          <Header />

        <div className="max-w-[1280px] mx-auto w-full px-4 pt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
          {state.error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {state.loading && <LoadingSkeleton />}

          {!state.loading && state.mainView === "endpoints" && (
            specLoaded ? (
              <Fade key="endpoints" className="flex-1 flex flex-col min-h-0">
                <EndpointsView />
              </Fade>
            ) : <NeedSpecEmpty />
          )}

          {!state.loading && state.mainView === "favorites" && (
            specLoaded ? (
              <Fade key="favorites" className="flex-1 flex flex-col min-h-0">
                <FavoritesView />
              </Fade>
            ) : <NeedSpecEmpty />
          )}

          {!state.loading && state.mainView === "models" && (
            specLoaded ? (
              <Fade key="models" className="flex-1 flex flex-col min-h-0">
                <ModelsView spec={state.spec!} sourceSpec={state.sourceSpec} />
              </Fade>
            ) : <NeedSpecEmpty />
          )}

          {!state.loading && state.mainView === "schemas" && (
            <Fade key="schemas" className="flex-1 flex flex-col min-h-0">
              <SchemaViewerView spec={state.spec ?? undefined} />
            </Fade>
          )}

          {!state.loading && state.mainView === "diagnostics" && (
            specLoaded ? (
              <Fade key="diagnostics" className="flex-1 flex flex-col min-h-0">
                <OpenAPIDiagnosticsView spec={state.spec!} sourceSpec={state.sourceSpec} />
              </Fade>
            ) : <NeedSpecEmpty />
          )}

          {!state.loading && state.mainView === "diff" && (
            <Fade key="diff" className="flex-1 flex flex-col min-h-0">
              <OpenAPIDiffView spec={state.spec ?? undefined} />
            </Fade>
          )}
        </div>

        {state.mainView === "endpoints" && (
          <SelectionFab
            count={state.selectedRoutes.size}
            onCopy={handleCopyEndpoints}
            onClear={clearRouteSelection}
          />
        )}

        {state.mainView === "models" && (
          <SelectionFab
            count={state.selectedModels.size}
            onCopy={handleCopyModels}
            onClear={clearModelSelection}
          />
        )}
        </SidebarInset>
      </SidebarProvider>
    </ShareProvider>
  )
}

function LoadingSkeleton() {
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 flex-1 max-w-sm" />
        <Skeleton className="h-8 w-24 ml-auto" />
      </div>
      {/* Tag filter skeleton */}
      <Skeleton className="h-8 w-40" />
      {/* Route card skeletons */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-14 rounded" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32 ml-auto" />
          </div>
        </div>
      ))}
    </motion.div>
  )
}

function NeedSpecEmpty() {
  const { t } = useTranslation()
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Upload />
        </EmptyMedia>
        <EmptyTitle>{t("app.title")}</EmptyTitle>
        <EmptyDescription>{t("app.emptyDesc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => openSettings("connection")}>
          <Settings className="size-4" />
          {t("app.openSettings")}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
