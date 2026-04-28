import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { useTranslation } from "react-i18next"
import { LinkIcon, Share2 } from "lucide-react"
import { toast } from "sonner"
import { useOpenAPIContext, type UrlState } from "@/contexts/OpenAPIContext"
import {
  buildShareLink,
  canShareOpenAPIUrl,
  type ShareLinkOptions,
  type ShareTarget,
} from "@/lib/share-link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

interface ShareDialogContextValue {
  openShareDialog: (target?: ShareTarget) => void
}

const ShareDialogContext = createContext<ShareDialogContextValue | null>(null)

function getCurrentUrlState(state: ReturnType<typeof useOpenAPIContext>["state"]): UrlState {
  return {
    mainView: state.mainView,
    filter: state.filter,
    activeTags: state.activeTags,
    activeEndpointKey: state.activeEndpointKey,
    endpointDetailTab: state.endpointDetailTab,
    modelFilter: state.modelFilter,
    modelViewMode: state.modelViewMode,
    activeModelName: state.activeModelName,
    schemaFilter: state.schemaFilter,
    schemaCategoryFilter: state.schemaCategoryFilter,
    schemaTypeFilter: state.schemaTypeFilter,
    activeSchemaName: state.activeSchemaName,
    schemaSource: state.schemaSource,
  }
}

function getDefaultOptions(specUrl: string, baseUrl: string): ShareLinkOptions {
  return {
    includeOpenAPIUrl: canShareOpenAPIUrl(specUrl),
    includeBaseUrl: baseUrl.trim().length > 0,
    includeLocation: true,
  }
}

export function ShareProvider({ children }: { children: ReactNode }) {
  const { state } = useOpenAPIContext()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<ShareTarget>({ type: "current" })
  const [options, setOptions] = useState<ShareLinkOptions>(() => getDefaultOptions(state.specUrl, state.baseUrl))

  const openShareDialog = useCallback((nextTarget?: ShareTarget) => {
    setTarget(nextTarget ?? { type: "current" })
    setOptions(getDefaultOptions(state.specUrl, state.baseUrl))
    setOpen(true)
  }, [state.baseUrl, state.specUrl])

  return (
    <ShareDialogContext.Provider value={{ openShareDialog }}>
      {children}
      <ShareDialogContent
        open={open}
        onOpenChange={setOpen}
        options={options}
        setOptions={setOptions}
        target={target}
      />
    </ShareDialogContext.Provider>
  )
}

export function useShareDialog() {
  const context = useContext(ShareDialogContext)
  if (!context) throw new Error("useShareDialog must be used within ShareProvider")
  return context
}

function ShareDialogContent({
  open,
  onOpenChange,
  options,
  setOptions,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: ShareLinkOptions
  setOptions: Dispatch<SetStateAction<ShareLinkOptions>>
  target: ShareTarget
}) {
  const { t } = useTranslation()
  const { state } = useOpenAPIContext()
  const shareableOpenAPI = canShareOpenAPIUrl(state.specUrl)
  const shareableBaseUrl = state.baseUrl.trim().length > 0
  const urlState = useMemo(() => getCurrentUrlState(state), [state])

  const shareLink = useMemo(() => buildShareLink({
    baseUrl: state.baseUrl,
    currentHref: window.location.href,
    options,
    specUrl: state.specUrl,
    state: urlState,
    target,
  }), [options, state.baseUrl, state.specUrl, target, urlState])

  const hasShareContent = (
    (options.includeOpenAPIUrl && shareableOpenAPI)
    || (options.includeBaseUrl && shareableBaseUrl)
    || options.includeLocation
  )

  const setOption = (key: keyof ShareLinkOptions, value: boolean) => {
    setOptions(current => ({ ...current, [key]: value }))
  }

  const locationDescription = useMemo(() => {
    if (target.type === "endpoint") {
      return t("share.endpointLocation", { label: target.label })
    }

    if (target.type === "model") {
      return t("share.modelLocation", { label: target.label })
    }

    return t("share.currentLocation")
  }, [target, t])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      toast.success(t("toast.shareCopied"))
      onOpenChange(false)
    } catch {
      toast.error(t("toast.shareCopyFailed"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <ShareOption
            id="share-openapi-url"
            checked={options.includeOpenAPIUrl && shareableOpenAPI}
            disabled={!shareableOpenAPI}
            title={t("share.openapiUrl")}
            description={shareableOpenAPI ? state.specUrl : t("share.localOpenAPI")}
            onCheckedChange={checked => setOption("includeOpenAPIUrl", checked)}
          />
          <ShareOption
            id="share-base-url"
            checked={options.includeBaseUrl && shareableBaseUrl}
            disabled={!shareableBaseUrl}
            title={t("share.baseUrl")}
            description={shareableBaseUrl ? state.baseUrl : t("share.noBaseUrl")}
            onCheckedChange={checked => setOption("includeBaseUrl", checked)}
          />
          <ShareOption
            id="share-location"
            checked={options.includeLocation}
            title={t("share.location")}
            description={locationDescription}
            onCheckedChange={checked => setOption("includeLocation", checked)}
          />
        </div>

        {!shareableOpenAPI && (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {t("share.localOpenAPIHint")}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="share-link">{t("share.link")}</FieldLabel>
          <Textarea
            id="share-link"
            readOnly
            rows={4}
            value={shareLink}
            className="min-h-24 w-full min-w-0 max-w-full resize-none font-mono text-xs [field-sizing:fixed] [overflow-wrap:anywhere]"
          />
        </Field>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("share.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!hasShareContent}
            onClick={copyLink}
          >
            <LinkIcon data-icon="inline-start" />
            {t("share.copyLink")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShareOption({
  checked,
  description,
  disabled = false,
  id,
  onCheckedChange,
  title,
}: {
  checked: boolean
  description: string
  disabled?: boolean
  id: string
  onCheckedChange: (checked: boolean) => void
  title: string
}) {
  return (
    <Label
      htmlFor={id}
      data-disabled={disabled}
      className="items-start rounded-md border p-3 data-[disabled=true]:opacity-60"
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={value => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span>{title}</span>
        <span className="truncate text-xs font-normal text-muted-foreground" title={description}>
          {description}
        </span>
      </span>
    </Label>
  )
}

export function HeaderShareButton() {
  const { t } = useTranslation()
  const { openShareDialog } = useShareDialog()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="shrink-0"
      onClick={() => openShareDialog()}
    >
      <Share2 data-icon="inline-start" />
      <span className="hidden sm:inline">{t("share.action")}</span>
    </Button>
  )
}
