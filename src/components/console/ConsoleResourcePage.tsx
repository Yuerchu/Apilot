import { useCallback } from "react"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleListPage } from "./ConsoleListPage"
import { ConsoleFormDialog } from "./ConsoleFormDialog"

export function ConsoleResourcePage({ resource }: { resource: ConsoleResource }) {
  const { state, dispatch } = useConsoleContext()

  const handleFormSuccess = useCallback(() => {
    dispatch({ type: "SET_SUB_VIEW", view: "list" })
  }, [dispatch])

  return (
    <>
      <ConsoleListPage resource={resource} />

      {state.subView === "create" && (
        <ConsoleFormDialog resource={resource} mode="create" onSuccess={handleFormSuccess} />
      )}
      {state.subView === "edit" && (
        <ConsoleFormDialog resource={resource} mode="edit" onSuccess={handleFormSuccess} />
      )}
    </>
  )
}
