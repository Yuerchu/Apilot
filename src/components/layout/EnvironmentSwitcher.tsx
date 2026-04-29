import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronsUpDown, Plus, Settings, Server } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/animate-ui/components/radix/sidebar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/components/radix/dialog"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { useEnvironments } from "@/hooks/use-environments"
import { openSettings } from "@/components/settings/SettingsDialog"

export function EnvironmentSwitcher() {
  const { t } = useTranslation()
  const { environments, activeEnv, switchEnvironment, addEnvironment } = useEnvironments()
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")

  const stagePriority: Record<string, number> = { local: 0, development: 1, testing: 2, staging: 3, production: 4, "": 5 }
  const sorted = [...environments].sort((a, b) => (stagePriority[a.stage] ?? 5) - (stagePriority[b.stage] ?? 5))
  const specEnvs = sorted.filter(e => e.source === "spec")
  const customEnvs = sorted.filter(e => e.source === "custom")

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return
    await addEnvironment(newName.trim(), newUrl.trim())
    setNewName("")
    setNewUrl("")
    setAddOpen(false)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Server className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {activeEnv?.name || t("environments.title")}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {activeEnv?.baseUrl || ""}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="end"
              side="right"
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t("environments.title")}
              </DropdownMenuLabel>
              {specEnvs.length > 0 && (
                <DropdownMenuGroup>
                  {specEnvs.map(env => (
                    <DropdownMenuItem
                      key={env.id}
                      onClick={() => switchEnvironment(env.id)}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <Server className="size-4 shrink-0" />
                      </div>
                      <div className="flex-1 truncate text-sm">{env.name}</div>
                      {env.id === activeEnv?.id && (
                        <Check className="size-4 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              )}
              {specEnvs.length > 0 && customEnvs.length > 0 && (
                <DropdownMenuSeparator />
              )}
              {customEnvs.length > 0 && (
                <DropdownMenuGroup>
                  {customEnvs.map(env => (
                    <DropdownMenuItem
                      key={env.id}
                      onClick={() => switchEnvironment(env.id)}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <Server className="size-4 shrink-0" />
                      </div>
                      <div className="flex-1 truncate text-sm">{env.name}</div>
                      {env.id === activeEnv?.id && (
                        <Check className="size-4 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2" onClick={() => setAddOpen(true)}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Plus className="size-4" />
                </div>
                <div className="text-sm text-muted-foreground">{t("environments.addNew")}</div>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 p-2" onClick={() => openSettings("connection")}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Settings className="size-4" />
                </div>
                <div className="text-sm text-muted-foreground">{t("environments.manage")}</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("environments.addNew")}</DialogTitle>
            <DialogDescription>{t("environments.addDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel htmlFor="env-new-name">{t("environments.name")}</FieldLabel>
              <Input
                id="env-new-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t("environments.namePlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="env-new-url">{t("environments.baseUrl")}</FieldLabel>
              <Input
                id="env-new-url"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://api.example.com"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                {t("storage.cancel")}
              </Button>
              <Button onClick={handleAdd} disabled={!newName.trim() || !newUrl.trim()}>
                {t("environments.add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
