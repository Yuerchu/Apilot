import type { ConsoleResource, ResourceLayout } from "@/lib/console/types"
import { ConsoleListPage } from "../ConsoleListPage"
import { LoginCardTemplate } from "./LoginCardTemplate"
import { FormCenteredTemplate } from "./FormCenteredTemplate"
import { ActionFormTemplate } from "./ActionFormTemplate"
import { ActionListTemplate } from "./ActionListTemplate"
import { DetailCardTemplate } from "./DetailCardTemplate"
import { EditorSplitTemplate } from "./EditorSplitTemplate"
import { UploadTemplate } from "./UploadTemplate"
import { StatsDashboardTemplate } from "./StatsDashboardTemplate"
import { ConfigFormTemplate } from "./ConfigFormTemplate"
import { SearchResultsTemplate } from "./SearchResultsTemplate"
import { PasswordChangeTemplate } from "./PasswordChangeTemplate"

export interface TemplateProps {
  resource: ConsoleResource
  layoutOverride?: ResourceLayout | undefined
}

export type TemplateComponent = React.ComponentType<TemplateProps>

export const TEMPLATE_COMPONENTS: Record<string, TemplateComponent> = {
  "crud-table": ConsoleListPage,
  "login-card": LoginCardTemplate,
  "register-form": LoginCardTemplate,
  "form-centered": FormCenteredTemplate,
  "action-form": ActionFormTemplate,
  "action-list": ActionListTemplate,
  "detail-card": DetailCardTemplate,
  "editor-split": EditorSplitTemplate,
  "upload-dropzone": UploadTemplate,
  "stats-dashboard": StatsDashboardTemplate,
  "config-form": ConfigFormTemplate,
  "search-results": SearchResultsTemplate,
  "password-change": PasswordChangeTemplate,
}
