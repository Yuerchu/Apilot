import { useConsoleContext } from "@/contexts/ConsoleContext"
import { ConsoleResourcePage } from "./ConsoleResourcePage"
import { ConsoleEmptyState } from "./ConsoleEmptyState"

export function ConsoleView() {
  const { activeResource } = useConsoleContext()

  if (!activeResource) {
    return <ConsoleEmptyState message="Select a resource from the sidebar." />
  }

  return <ConsoleResourcePage resource={activeResource} />
}
