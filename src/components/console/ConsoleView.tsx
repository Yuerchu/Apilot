import { useTranslation } from "react-i18next"
import { useConsoleContext } from "@/contexts/ConsoleContext"
import { ConsoleResourcePage } from "./ConsoleResourcePage"
import { ConsoleEmptyState } from "./ConsoleEmptyState"

export function ConsoleView() {
  const { t } = useTranslation()
  const { activeResource } = useConsoleContext()

  if (!activeResource) {
    return <ConsoleEmptyState message={t("console.selectResource")} />
  }

  return <ConsoleResourcePage resource={activeResource} />
}
