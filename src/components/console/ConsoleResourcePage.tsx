import { useMemo, useCallback } from "react"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { selectBestTemplate } from "@/lib/console/templates"
import { TEMPLATE_COMPONENTS } from "./templates"
import { ConsoleFormDialog } from "./ConsoleFormDialog"
import { ConsoleBuilder } from "./builder/ConsoleBuilder"

export function ConsoleResourcePage({ resource }: { resource: ConsoleResource }) {
  const { state, dispatch, activeLayout } = useConsoleContext()

  const template = useMemo(
    () => selectBestTemplate(resource, activeLayout?.templateId),
    [resource, activeLayout?.templateId],
  )

  const Component = TEMPLATE_COMPONENTS[template.id] ?? TEMPLATE_COMPONENTS["action-list"]!

  const handleFormSuccess = useCallback(() => {
    dispatch({ type: "SET_SUB_VIEW", view: "list" })
  }, [dispatch])

  if (state.builderMode) {
    return <ConsoleBuilder resource={resource} listData={null} />
  }

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
