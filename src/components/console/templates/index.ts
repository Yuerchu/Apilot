import type { ConsoleResource } from "@/lib/console/types"
import { ConsoleListPage } from "../ConsoleListPage"
import { LoginCardTemplate } from "./LoginCardTemplate"
import { FormCenteredTemplate } from "./FormCenteredTemplate"
import { ActionFormTemplate } from "./ActionFormTemplate"
import { ActionListTemplate } from "./ActionListTemplate"
import { DetailCardTemplate } from "./DetailCardTemplate"
import { EditorSplitTemplate } from "./EditorSplitTemplate"

export type TemplateComponent = React.ComponentType<{ resource: ConsoleResource }>

export const TEMPLATE_COMPONENTS: Record<string, TemplateComponent> = {
  "crud-table": ConsoleListPage,
  "login-card": LoginCardTemplate,
  "register-form": LoginCardTemplate,
  "form-centered": FormCenteredTemplate,
  "action-form": ActionFormTemplate,
  "action-list": ActionListTemplate,
  "detail-card": DetailCardTemplate,
  "editor-split": EditorSplitTemplate,
}
