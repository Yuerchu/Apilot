import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Route, Database } from "lucide-react"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { getParsedRouteKey } from "@/lib/openapi/route-key"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MainView } from "@/lib/openapi/types"

const METHOD_COLORS: Record<string, string> = {
  get: "text-method-get",
  post: "text-method-post",
  put: "text-method-put",
  patch: "text-method-patch",
  delete: "text-method-delete",
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation()
  const { state, setMainView, setActiveEndpointKey, setActiveModelName, setEndpointDetailTab } = useOpenAPIContext()

  const schemas = state.spec?.components?.schemas || state.spec?.definitions || {}
  const modelNames = Object.keys(schemas)

  const navigate = useCallback((type: "endpoint" | "model", key: string) => {
    onOpenChange(false)
    if (type === "endpoint") {
      setMainView("endpoints" as MainView)
      setActiveEndpointKey(key)
      setEndpointDetailTab("doc")
    } else {
      setMainView("models" as MainView)
      setActiveModelName(key)
    }
  }, [onOpenChange, setMainView, setActiveEndpointKey, setActiveModelName, setEndpointDetailTab])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("search.placeholder")}
      description={t("search.hint")}
      showCloseButton={false}
    >
      <CommandInput placeholder={t("search.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("search.noResults")}</CommandEmpty>

        {state.routes.length > 0 && (
          <CommandGroup heading={t("search.endpoints")}>
            {state.routes.map(route => {
              const routeKey = getParsedRouteKey(route)
              const keywords = [route.method, route.path, route.summary, route.description, route.operationId, ...route.tags].filter(Boolean)
              return (
                <CommandItem
                  key={routeKey}
                  value={keywords.join(" ")}
                  onSelect={() => navigate("endpoint", routeKey)}
                  className="gap-2"
                >
                  <Route className="size-3.5 shrink-0 text-muted-foreground" />
                  <Badge variant="outline" className={cn("text-[9px] font-bold px-1 py-0 shrink-0", METHOD_COLORS[route.method])}>
                    {route.method.toUpperCase()}
                  </Badge>
                  <span className="truncate font-mono text-xs">{route.path}</span>
                  {route.summary && (
                    <span className="ml-auto truncate text-xs text-muted-foreground max-w-[200px]">{route.summary}</span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {modelNames.length > 0 && (
          <CommandGroup heading={t("search.models")}>
            {modelNames.map(name => {
              const schema = schemas[name]
              const keywords = [name, schema?.description, schema?.title].filter(Boolean)
              return (
                <CommandItem
                  key={name}
                  value={keywords.join(" ")}
                  onSelect={() => navigate("model", name)}
                  className="gap-2"
                >
                  <Database className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-xs">{name}</span>
                  {schema?.description && (
                    <span className="ml-auto truncate text-xs text-muted-foreground max-w-[200px]">{schema.description.substring(0, 60)}</span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
