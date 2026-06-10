import { useCallback } from "react"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { selectBestTemplate, selectActionTemplate } from "@/lib/console/templates"
import { getRequestBodySchema } from "@/lib/console/schema-inference"
import { TEMPLATE_COMPONENTS } from "./templates"
import { ConsoleFormDialog } from "./ConsoleFormDialog"
import { ConsoleBuilder } from "./builder/ConsoleBuilder"
import { ConsoleActionPage } from "./ConsoleActionPage"

export function ConsoleResourcePage({ resource }: { resource: ConsoleResource }) {
  const { state, dispatch, activeAction, activeLayout } = useConsoleContext()

  const handleFormSuccess = useCallback(() => {
    dispatch({ type: "SET_SUB_VIEW", view: "list" })
  }, [dispatch])

  if (state.builderMode) {
    return <ConsoleBuilder resource={resource} listData={null} />
  }

  if (activeAction) {
    const actionTemplate = selectActionTemplate(activeAction)
    const ActionComponent = TEMPLATE_COMPONENTS[actionTemplate.id]
    if (ActionComponent) {
      const method = activeAction.route.method.toUpperCase()
      const syntheticOps: typeof resource.operations = {}
      if (method === "GET") syntheticOps.read = activeAction
      else if (method === "POST") syntheticOps.create = activeAction
      else if (method === "PUT" || method === "PATCH") syntheticOps.update = activeAction
      else if (method === "DELETE") syntheticOps.delete = activeAction

      const actionResource: ConsoleResource = {
        ...resource,
        displayName: activeAction.label,
        basePath: activeAction.route.path,
        actions: [activeAction],
        operations: syntheticOps,
        createSchema: getRequestBodySchema(activeAction.route),
        updateSchema: method === "PUT" || method === "PATCH" ? getRequestBodySchema(activeAction.route) : null,
        listItemSchema: null,
        detailSchema: null,
      }
      return <ActionComponent key={`${resource.basePath}:action:${state.activeActionIndex}`} resource={actionResource} />
    }
    return <ConsoleActionPage key={resource.basePath} resource={resource} />
  }

  const template = selectBestTemplate(resource, activeLayout?.templateId)
  const Component = TEMPLATE_COMPONENTS[template.id] ?? TEMPLATE_COMPONENTS["action-list"]!

  return (
    <>
      <Component key={resource.basePath} resource={resource} />

      {state.subView === "create" && (
        <ConsoleFormDialog resource={resource} mode="create" onSuccess={handleFormSuccess} />
      )}
      {state.subView === "edit" && template.id === "crud-table" && (
        <ConsoleFormDialog resource={resource} mode="edit" onSuccess={handleFormSuccess} />
      )}
    </>
  )
}
