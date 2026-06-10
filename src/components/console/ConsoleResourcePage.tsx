import { useCallback } from "react"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { selectBestTemplate, selectActionTemplate } from "@/lib/console/templates"
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
      const actionResource: ConsoleResource = {
        ...resource,
        displayName: activeAction.label,
        actions: [activeAction],
        operations: {},
        createSchema: null,
        updateSchema: null,
        listItemSchema: null,
        detailSchema: null,
      }
      return <ActionComponent resource={actionResource} />
    }
    return <ConsoleActionPage resource={resource} />
  }

  const template = selectBestTemplate(resource, activeLayout?.templateId)
  const Component = TEMPLATE_COMPONENTS[template.id] ?? TEMPLATE_COMPONENTS["action-list"]!

  return (
    <>
      <Component resource={resource} />

      {state.subView === "create" && (
        <ConsoleFormDialog resource={resource} mode="create" onSuccess={handleFormSuccess} />
      )}
      {state.subView === "edit" && template.id === "crud-table" && (
        <ConsoleFormDialog resource={resource} mode="edit" onSuccess={handleFormSuccess} />
      )}
    </>
  )
}
