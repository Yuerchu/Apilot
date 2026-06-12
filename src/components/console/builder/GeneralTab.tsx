import { useState } from "react"
import { useTranslation } from "react-i18next"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PAGE_TEMPLATES } from "@/lib/console/templates"
import type { ConsoleResource, ResourceLayout } from "@/lib/console/types"

const AUTO = "__auto__"

interface GeneralTabProps {
  resource: ConsoleResource
  draft: ResourceLayout
  onChange: (patch: Partial<ResourceLayout>) => void
  onReset: () => void
}

export function GeneralTab({ resource, draft, onChange, onReset }: GeneralTabProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("console.builder.templateLabel")}</Label>
        <Select
          value={draft.templateId ?? AUTO}
          onValueChange={v => onChange({ templateId: v === AUTO ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{t("console.builder.autoTemplate")}</SelectItem>
            {PAGE_TEMPLATES.map(tpl => (
              <SelectItem key={tpl.id} value={tpl.id}>{t(tpl.name)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("console.builder.displayName")}</Label>
        <Input
          value={draft.displayNameOverride ?? ""}
          onChange={e => onChange({ displayNameOverride: e.target.value || undefined })}
          placeholder={resource.displayName}
          className="h-8 text-xs"
        />
      </div>

      <div className="pt-2 border-t">
        <Button size="sm" variant="outline" className="w-full text-xs text-destructive" onClick={() => setConfirmOpen(true)}>
          <RotateCcw className="size-3.5 mr-1" />
          {t("console.builder.reset")}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("console.builder.reset")}</AlertDialogTitle>
            <AlertDialogDescription>{t("console.builder.resetConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("console.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>{t("console.builder.reset")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
