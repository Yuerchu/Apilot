import { useTranslation } from "react-i18next"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { ConsoleResourcePage } from "./ConsoleResourcePage"
import { ConsoleEmptyState } from "./ConsoleEmptyState"

export function ConsoleView() {
  const { t } = useTranslation()
  const { activeResource, state } = useConsoleContext()

  if (!activeResource) {
    return <ConsoleEmptyState message={t("console.selectResource")} />
  }

  if (state.builderMode) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <ConsoleResourcePage resource={activeResource} />
      </div>
    )
  }

  return <ConsoleResourcePage resource={activeResource} />
}
