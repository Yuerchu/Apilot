import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { useAuthContext } from "@/contexts/AuthContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useEnvironments } from "@/hooks/use-environments"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AuthType } from "@/lib/openapi/types"
import { toast } from "sonner"

export function AuthSettings() {
  const { t } = useTranslation()
  const auth = useAuthContext()
  const { getOAuth2TokenUrl, getOAuth2Endpoints } = useOpenAPI()
  const { activeEnv } = useEnvironments()

  const [oauth2User, setOAuth2User] = useState("")
  const [oauth2Pass, setOAuth2Pass] = useState("")
  const [oauth2UrlEdited, setOAuth2UrlEdited] = useState(false)
  const detectedTokenUrl = getOAuth2TokenUrl()
  const oauth2Endpoints = getOAuth2Endpoints()
  const [oauth2TokenUrl, setOAuth2TokenUrl] = useState(() => detectedTokenUrl ?? "")

  // Fill detected URL only if user hasn't manually edited
  const effectiveTokenUrl = oauth2UrlEdited ? oauth2TokenUrl : (detectedTokenUrl ?? oauth2TokenUrl)
  const handleTokenUrlChange = (v: string) => {
    setOAuth2UrlEdited(true)
    setOAuth2TokenUrl(v)
  }

  const handleOAuth2Login = async () => {
    const result = await auth.oauth2Login(oauth2User, oauth2Pass, effectiveTokenUrl)
    if (result.success) toast.success(t("toast.oauth2Success"))
    else toast.error(result.error || t("toast.loginFailed"))
  }

  const FLOW_LABELS: Record<string, string> = {
    password: "Password (Resource Owner)",
    clientCredentials: "Client Credentials",
    authorizationCode: "Authorization Code",
    implicit: "Implicit",
  }

  return (
    <div className="space-y-6">
      {activeEnv && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("environments.authNote")}</span>
          <Badge variant="secondary" className="text-[10px]">{activeEnv.name}</Badge>
        </div>
      )}
      <Field>
        <FieldLabel htmlFor="auth-type">{t("auth.type")}</FieldLabel>
        <Select value={auth.authType} onValueChange={v => auth.setAuthType(v as AuthType)}>
          <SelectTrigger id="auth-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("auth.none")}</SelectItem>
            <SelectItem value="bearer">{t("auth.bearer")}</SelectItem>
            <SelectItem value="basic">{t("auth.basic")}</SelectItem>
            <SelectItem value="apikey">{t("auth.apikey")}</SelectItem>
            <SelectItem value="oauth2">{t("auth.oauth2")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {auth.authType === "bearer" && (
        <Field>
          <FieldLabel htmlFor="auth-bearer-token">Token</FieldLabel>
          <Input id="auth-bearer-token" type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="Bearer token" />
        </Field>
      )}

      {auth.authType === "basic" && (
        <div className="space-y-3">
          <Field>
            <FieldLabel htmlFor="auth-basic-user">Username</FieldLabel>
            <Input id="auth-basic-user" value={auth.authUser} onChange={e => auth.setAuthUser(e.target.value)} placeholder="Username" />
          </Field>
          <Field>
            <FieldLabel htmlFor="auth-basic-pass">Password</FieldLabel>
            <Input id="auth-basic-pass" type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="Password" />
          </Field>
        </div>
      )}

      {auth.authType === "apikey" && (
        <div className="space-y-3">
          <Field>
            <FieldLabel htmlFor="auth-apikey-name">Header Name</FieldLabel>
            <Input id="auth-apikey-name" value={auth.authKeyName} onChange={e => auth.setAuthKeyName(e.target.value)} placeholder="X-API-Key" />
          </Field>
          <Field>
            <FieldLabel htmlFor="auth-apikey-value">API Key</FieldLabel>
            <Input id="auth-apikey-value" type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="API Key" />
          </Field>
        </div>
      )}

      {auth.authType === "oauth2" && (
        <div className="space-y-3">
          {/* Detected OAuth2 info from spec */}
          {oauth2Endpoints && (
            <div className="rounded-md border bg-muted/20 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{oauth2Endpoints.schemeName}</span>
                <Badge variant="secondary" className="text-[9px]">
                  {FLOW_LABELS[oauth2Endpoints.flow] ?? oauth2Endpoints.flow}
                </Badge>
              </div>
              {oauth2Endpoints.tokenUrl && (
                <div className="text-[11px] text-muted-foreground truncate">
                  Token: <code className="font-mono">{oauth2Endpoints.tokenUrl}</code>
                </div>
              )}
              {oauth2Endpoints.refreshUrl && (
                <div className="text-[11px] text-muted-foreground truncate">
                  Refresh: <code className="font-mono">{oauth2Endpoints.refreshUrl}</code>
                </div>
              )}
              {oauth2Endpoints.authorizationUrl && (
                <div className="text-[11px] text-muted-foreground truncate">
                  Authorization: <code className="font-mono">{oauth2Endpoints.authorizationUrl}</code>
                </div>
              )}
              {Object.keys(oauth2Endpoints.scopes).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.keys(oauth2Endpoints.scopes).map(scope => (
                    <Badge key={scope} variant="outline" className="text-[9px]">{scope}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {oauth2Endpoints?.flow === "password" || !oauth2Endpoints ? (
            <>
              <Field>
                <FieldLabel htmlFor="auth-oauth2-user">Username</FieldLabel>
                <Input id="auth-oauth2-user" value={oauth2User} onChange={e => setOAuth2User(e.target.value)} placeholder="Username" />
              </Field>
              <Field>
                <FieldLabel htmlFor="auth-oauth2-pass">Password</FieldLabel>
                <Input id="auth-oauth2-pass" type="password" value={oauth2Pass} onChange={e => setOAuth2Pass(e.target.value)} placeholder="Password" />
              </Field>
              <Field>
                <FieldLabel htmlFor="auth-oauth2-url">Token URL</FieldLabel>
                {detectedTokenUrl && !oauth2UrlEdited && (
                  <FieldDescription>{t("auth.detectedFromSpec")}</FieldDescription>
                )}
                <Input id="auth-oauth2-url" value={effectiveTokenUrl} onChange={e => handleTokenUrlChange(e.target.value)} placeholder="https://..." />
              </Field>
              <Button onClick={handleOAuth2Login} disabled={auth.oauth2Loading} className="w-full">
                {auth.oauth2Loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("auth.login")}
              </Button>
              {auth.oauth2Token && <span className="text-sm text-success">{t("auth.authenticated")}</span>}
            </>
          ) : (
            <div className="rounded-md border bg-muted/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {t("auth.oauth2FlowNotSupported", { flow: FLOW_LABELS[oauth2Endpoints.flow] ?? oauth2Endpoints.flow })}
              </p>
              <Field className="mt-2">
                <FieldLabel htmlFor="auth-oauth2-manual">Token</FieldLabel>
                <Input
                  id="auth-oauth2-manual"
                  type="password"
                  value={auth.oauth2Token ?? ""}
                  onChange={e => auth.setOAuth2Token(e.target.value || null)}
                  placeholder="Paste access token"
                />
              </Field>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
