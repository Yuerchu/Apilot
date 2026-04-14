import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { OpenAPIProvider, useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useSettings } from "@/hooks/use-settings"
import { Header } from "@/components/layout/Header"
import { Skeleton } from "@/components/ui/skeleton"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SelectionFab } from "@/components/layout/SelectionFab"
import { EndpointsView } from "@/components/endpoints/EndpointsView"
import { ModelsView } from "@/components/models/ModelsView"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { toast } from "sonner"

export default function App() {
  return (
    <OpenAPIProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </OpenAPIProvider>
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
    if (state.selectedRoutes.size === 0) {
      toast.warning(t("toast.selectEndpoints"))
      return
    }
    toast.info(t("toast.useToolbar"))
  }

  const handleCopyModels = () => {
    if (state.selectedModels.size === 0) {
      toast.warning(t("toast.selectModelsWarn"))
      return
    }
    toast.info(t("toast.useModelToolbar"))
  }

  return (
    <SidebarProvider defaultOpen={!isEmbedded}>
      <AppSidebar auth={auth} />
      <SidebarInset>
        <Header />

        <div className="max-w-[1280px] mx-auto w-full px-4 pt-4 pb-20">
          {state.error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {!specLoaded && !state.loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <h2 className="text-xl font-semibold mb-2">{t("app.title")}</h2>
              <p className="text-muted-foreground">
                {t("app.emptyDesc")}
              </p>
            </div>
          )}

          {state.loading && <LoadingSkeleton />}

          {specLoaded && !state.loading && state.mainView === "endpoints" && (
            <EndpointsView />
          )}

          {specLoaded && !state.loading && state.mainView === "models" && (
            <ModelsView spec={state.spec!} />
          )}
        </div>

        {state.mainView === "endpoints" && (
          <SelectionFab
            count={state.selectedRoutes.size}
            label={t("unit.count")}
            onCopy={handleCopyEndpoints}
            onClear={clearRouteSelection}
          />
        )}

        {state.mainView === "models" && (
          <SelectionFab
            count={state.selectedModels.size}
            label={t("unit.modelCount")}
            onCopy={handleCopyModels}
            onClear={clearModelSelection}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
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
    </div>
  )
}
