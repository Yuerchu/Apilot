import { useEffect, useMemo } from "react"
import { OpenAPIProvider, useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useSettings } from "@/hooks/use-settings"
import { Header } from "@/components/layout/Header"
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
      toast.warning("未选择任何端点")
      return
    }
    toast.info("请使用端点列表工具栏的复制按钮")
  }

  const handleCopyModels = () => {
    if (state.selectedModels.size === 0) {
      toast.warning("未选择任何模型")
      return
    }
    toast.info("请使用数据模型工具栏的复制按钮")
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
              <h2 className="text-xl font-semibold mb-2">OpenAPI Advance</h2>
              <p className="text-muted-foreground">
                在侧边栏中输入 OpenAPI 规范的 URL 或上传本地文件
              </p>
            </div>
          )}

          {specLoaded && state.mainView === "endpoints" && (
            <EndpointsView />
          )}

          {specLoaded && state.mainView === "models" && (
            <ModelsView spec={state.spec!} />
          )}
        </div>

        {state.mainView === "endpoints" && (
          <SelectionFab
            count={state.selectedRoutes.size}
            label="个"
            onCopy={handleCopyEndpoints}
            onClear={clearRouteSelection}
          />
        )}

        {state.mainView === "models" && (
          <SelectionFab
            count={state.selectedModels.size}
            label="个模型"
            onCopy={handleCopyModels}
            onClear={clearModelSelection}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
