import { useEffect, useMemo } from "react"
import { OpenAPIProvider, useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useAuth } from "@/hooks/use-auth"
import { useSettings } from "@/hooks/use-settings"
import { Header } from "@/components/layout/Header"
import { ServerBar } from "@/components/layout/ServerBar"
import { AuthBar } from "@/components/layout/AuthBar"
import { InfoBar } from "@/components/layout/InfoBar"
import { SelectionFab } from "@/components/layout/SelectionFab"
import { EndpointsView } from "@/components/endpoints/EndpointsView"
import { ModelsView } from "@/components/models/ModelsView"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import type { MainView } from "@/lib/openapi/types"

export default function App() {
  return (
    <OpenAPIProvider>
      <AppContent />
    </OpenAPIProvider>
  )
}

function AppContent() {
  const {
    state,
    setMainView,
    clearRouteSelection,
    clearModelSelection,
  } = useOpenAPIContext()
  const { loadFromUrl, getSchemas } = useOpenAPI()
  const auth = useAuth()

  useSettings({
    authType: auth.authType,
    authToken: auth.authToken,
    authUser: auth.authUser,
    authKeyName: auth.authKeyName,
    oauth2Token: auth.oauth2Token,
  })

  const isEmbedded = useMemo(() => !!window.__OPENAPI_URL__, [])

  useEffect(() => {
    if (window.__OPENAPI_URL__) {
      loadFromUrl(window.__OPENAPI_URL__)
      if (window.__OPENAPI_TITLE__) document.title = window.__OPENAPI_TITLE__
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const schemas = getSchemas()
  const hasSchemas = Object.keys(schemas).length > 0
  const specLoaded = !!state.spec

  const handleCopyEndpoints = () => {
    if (state.selectedRoutes.size === 0) {
      toast.warning("未选择任何端点")
      return
    }
    // Actual copy logic is in EndpointsView
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
    <div className="min-h-screen bg-background text-foreground max-w-[1280px] mx-auto">
      {!isEmbedded && <Header />}

      {specLoaded && <ServerBar />}
      {specLoaded && <AuthBar auth={auth} />}
      {specLoaded && <InfoBar />}

      {specLoaded && hasSchemas && (
        <div className="px-3 py-2 border-b border-border">
          <Tabs
            value={state.mainView}
            onValueChange={v => setMainView(v as MainView)}
          >
            <TabsList>
              <TabsTrigger value="endpoints">API 端点</TabsTrigger>
              <TabsTrigger value="models">数据模型</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {state.error && (
        <div className="mx-3 mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {!specLoaded && !state.loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h2 className="text-xl font-semibold mb-2">OpenAPI Advance</h2>
          <p className="text-muted-foreground">
            输入 OpenAPI 规范的 URL 或上传本地文件
            <br />
            选择路由后一键复制完整 Schema 供大模型使用，也可直接发起请求测试
          </p>
        </div>
      )}

      {specLoaded && state.mainView === "endpoints" && (
        <EndpointsView />
      )}

      {specLoaded && state.mainView === "models" && (
        <ModelsView spec={state.spec!} />
      )}

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
    </div>
  )
}
