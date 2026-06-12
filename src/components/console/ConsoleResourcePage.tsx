import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource, ResourceAction } from "@/lib/console/types"
import { selectBestTemplate, selectActionTemplate, PAGE_TEMPLATES } from "@/lib/console/templates"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { TEMPLATE_COMPONENTS } from "./templates"
import { ConsoleFormDialog } from "./ConsoleFormDialog"
import { ConsoleBuilder } from "./builder/ConsoleBuilder"
import { ActionListTemplate } from "./templates/ActionListTemplate"

/**
 * Build a synthetic single-action resource keyed by the action's route path.
 * Layouts for action pages persist under this basePath in state.layouts.
 */
export function buildActionResource(resource: ConsoleResource, action: ResourceAction): ConsoleResource {
  const method = action.route.method.toUpperCase()
  const syntheticOps: ConsoleResource["operations"] = {}
  if (method === "GET") syntheticOps.read = action
  else if (method === "POST") syntheticOps.create = action
  else if (method === "PUT" || method === "PATCH") syntheticOps.update = action
  else if (method === "DELETE") syntheticOps.delete = action

  return {
    ...resource,
    displayName: action.label,
    basePath: action.route.path,
    actions: [action],
    operations: syntheticOps,
    createSchema: getRequestBodySchema(action.route),
    updateSchema: method === "PUT" || method === "PATCH" ? getRequestBodySchema(action.route) : null,
    listItemSchema: null,
    detailSchema: null,
  }
}

function BuilderEntryButton() {
  const { t } = useTranslation()
  const { dispatch } = useConsoleContext()
  return (
    <Button
      size="sm"
      variant="outline"
      className="absolute top-2 right-2 z-10 h-7"
      title={t("console.builder.openBuilder")}
      onClick={() => dispatch({ type: "SET_BUILDER_MODE", on: true })}
    >
      <Settings2 className="size-3.5" />
    </Button>
  )
}

export function ConsoleResourcePage({ resource }: { resource: ConsoleResource }) {
  const { state, dispatch, activeAction, activeLayout } = useConsoleContext()

  const handleFormSuccess = useCallback(() => {
    dispatch({ type: "SET_SUB_VIEW", view: "list" })
    dispatch({ type: "REFRESH" })
  }, [dispatch])

  if (state.builderMode) {
    const builderResource = activeAction ? buildActionResource(resource, activeAction) : resource
    return <ConsoleBuilder resource={builderResource} listData={null} />
  }

  if (activeAction) {
    // Action-page layouts are keyed by the action's route path, not the parent basePath
    const actionLayout = state.layouts[activeAction.route.path] ?? null
    const overrideTpl = actionLayout?.templateId
      ? PAGE_TEMPLATES.find(t => t.id === actionLayout.templateId)
      : undefined
    const actionTemplate = overrideTpl ?? selectActionTemplate(activeAction)
    const ActionComponent = TEMPLATE_COMPONENTS[actionTemplate.id]
    if (ActionComponent) {
      const actionResource = buildActionResource(resource, activeAction)
      return (
        <div className="relative flex-1 flex flex-col min-h-0">
          <BuilderEntryButton />
          <ActionComponent
            key={`${resource.basePath}:action:${state.activeActionIndex}`}
            resource={actionResource}
            // Empty object (not undefined) so templates don't fall back to the parent resource's activeLayout
            layoutOverride={actionLayout ?? {}}
          />
        </div>
      )
    }
    return <ActionListTemplate key={resource.basePath} resource={resource} />
  }

  const template = selectBestTemplate(resource, activeLayout?.templateId)
  const Component = TEMPLATE_COMPONENTS[template.id] ?? TEMPLATE_COMPONENTS["action-list"]!

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* crud-table has its own toolbar builder button; floating button covers the other templates */}
      {template.id !== "crud-table" && <BuilderEntryButton />}
      <Component key={resource.basePath} resource={resource} />

      {state.subView === "create" && (
        <ConsoleFormDialog resource={resource} mode="create" onSuccess={handleFormSuccess} />
      )}
      {state.subView === "edit" && template.id === "crud-table" && (
        <ConsoleFormDialog resource={resource} mode="edit" initialData={state.editingRow ?? undefined} onSuccess={handleFormSuccess} />
      )}
    </div>
  )
}
