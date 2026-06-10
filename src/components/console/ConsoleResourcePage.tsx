import { useCallback } from "react"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleListPage } from "./ConsoleListPage"
import { ConsoleDetailPage } from "./ConsoleDetailPage"
import { ConsoleFormPage } from "./ConsoleFormPage"
import { ConsoleActionPage } from "./ConsoleActionPage"
import { ConsoleFormDialog } from "./ConsoleFormDialog"
import { ConsoleBuilder } from "./builder/ConsoleBuilder"

export function ConsoleResourcePage({ resource }: { resource: ConsoleResource }) {
  const { state, dispatch } = useConsoleContext()

  const handleFormSuccess = useCallback(() => {
    dispatch({ type: "SET_SUB_VIEW", view: "list" })
  }, [dispatch])

  if (state.builderMode) {
    return <ConsoleBuilder resource={resource} listData={null} />
  }

  return (
    <>
      {resource.pageType === "table" && <ConsoleListPage resource={resource} />}
      {resource.pageType === "detail" && <ConsoleDetailPage resource={resource} />}
      {resource.pageType === "editor" && <ConsoleDetailPage resource={resource} />}
      {resource.pageType === "form" && <ConsoleFormPage resource={resource} />}
      {resource.pageType === "action" && <ConsoleActionPage resource={resource} />}

      {resource.pageType === "table" && state.subView === "create" && (
        <ConsoleFormDialog resource={resource} mode="create" onSuccess={handleFormSuccess} />
      )}
      {resource.pageType === "table" && state.subView === "edit" && (
        <ConsoleFormDialog resource={resource} mode="edit" onSuccess={handleFormSuccess} />
      )}
    </>
  )
}
