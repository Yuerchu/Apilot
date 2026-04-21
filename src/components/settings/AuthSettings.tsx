import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { useAuthContext } from "@/contexts/AuthContext"
import { useOpenAPI } from "@/hooks/use-openapi"
import { useEnvironments } from "@/hooks/use-environments"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  const { getOAuth2TokenUrl } = useOpenAPI()
  const { activeEnv } = useEnvironments()

  const [oauth2User, setOAuth2User] = useState("")
  const [oauth2Pass, setOAuth2Pass] = useState("")
  const [oauth2TokenUrl, setOAuth2TokenUrl] = useState("")

  const detectedTokenUrl = getOAuth2TokenUrl()

  useEffect(() => {
    if (detectedTokenUrl && !oauth2TokenUrl) setOAuth2TokenUrl(detectedTokenUrl)
  }, [detectedTokenUrl, oauth2TokenUrl])

  const handleOAuth2Login = async () => {
    const result = await auth.oauth2Login(oauth2User, oauth2Pass, oauth2TokenUrl)
    if (result.success) toast.success(t("toast.oauth2Success"))
    else toast.error(result.error || t("toast.loginFailed"))
  }

  return (
    <div className="space-y-6">
      {activeEnv && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("environments.authNote")}</span>
          <Badge variant="secondary" className="text-[10px]">{activeEnv.name}</Badge>
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("sidebar.auth")}</Label>
        <Select value={auth.authType} onValueChange={v => auth.setAuthType(v as AuthType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("sidebar.authNone")}</SelectItem>
            <SelectItem value="bearer">{t("sidebar.authBearer")}</SelectItem>
            <SelectItem value="basic">{t("sidebar.authBasic")}</SelectItem>
            <SelectItem value="apikey">{t("sidebar.authApiKey")}</SelectItem>
            <SelectItem value="oauth2">{t("sidebar.authOAuth2")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {auth.authType === "bearer" && (
        <div className="space-y-2">
          <Label>Token</Label>
          <Input type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="Bearer token" />
        </div>
      )}

      {auth.authType === "basic" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={auth.authUser} onChange={e => auth.setAuthUser(e.target.value)} placeholder="Username" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="Password" />
          </div>
        </div>
      )}

      {auth.authType === "apikey" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Header Name</Label>
            <Input value={auth.authKeyName} onChange={e => auth.setAuthKeyName(e.target.value)} placeholder="X-API-Key" />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" value={auth.authToken} onChange={e => auth.setAuthToken(e.target.value)} placeholder="API Key" />
          </div>
        </div>
      )}

      {auth.authType === "oauth2" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={oauth2User} onChange={e => setOAuth2User(e.target.value)} placeholder="Username" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={oauth2Pass} onChange={e => setOAuth2Pass(e.target.value)} placeholder="Password" />
          </div>
          <div className="space-y-2">
            <Label>Token URL</Label>
            <Input value={oauth2TokenUrl} onChange={e => setOAuth2TokenUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button onClick={handleOAuth2Login} disabled={auth.oauth2Loading} className="w-full">
            {auth.oauth2Loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("sidebar.login")}
          </Button>
          {auth.oauth2Token && <span className="text-sm text-success">{t("sidebar.authenticated")}</span>}
        </div>
      )}
    </div>
  )
}
