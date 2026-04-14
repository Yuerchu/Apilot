import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { useOpenAPI } from "@/hooks/use-openapi"
import { toast } from "sonner"
import type { AuthType } from "@/lib/openapi/types"

interface AuthBarProps {
  auth: ReturnType<typeof useAuth>
}

export function AuthBar({ auth }: AuthBarProps) {
  const { getOAuth2TokenUrl } = useOpenAPI()
  const [oauth2User, setOAuth2User] = useState("")
  const [oauth2Pass, setOAuth2Pass] = useState("")
  const [oauth2TokenUrl, setOAuth2TokenUrl] = useState("")

  const detectedTokenUrl = getOAuth2TokenUrl()

   
  useEffect(() => {
    if (detectedTokenUrl && !oauth2TokenUrl) {
      setOAuth2TokenUrl(detectedTokenUrl)
    }
  }, [detectedTokenUrl, oauth2TokenUrl])

  const handleOAuth2Login = async () => {
    const result = await auth.oauth2Login(oauth2User, oauth2Pass, oauth2TokenUrl)
    if (result.success) {
      toast.success("OAuth2 登录成功")
    } else {
      toast.error(result.error || "登录失败")
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-wrap">
      <span className="text-sm font-medium text-muted-foreground shrink-0">Auth:</span>
      <Select value={auth.authType} onValueChange={v => auth.setAuthType(v as AuthType)}>
        <SelectTrigger className="w-auto" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">无认证</SelectItem>
          <SelectItem value="bearer">Bearer Token</SelectItem>
          <SelectItem value="basic">Basic Auth</SelectItem>
          <SelectItem value="apikey">API Key (Header)</SelectItem>
          <SelectItem value="oauth2">OAuth2 Password</SelectItem>
        </SelectContent>
      </Select>

      {auth.authType === "bearer" && (
        <Input
          type="password"
          value={auth.authToken}
          onChange={e => auth.setAuthToken(e.target.value)}
          placeholder="Token"
          className="max-w-[300px]"
        />
      )}

      {auth.authType === "basic" && (
        <>
          <Input
            value={auth.authUser}
            onChange={e => auth.setAuthUser(e.target.value)}
            placeholder="Username"
            className="max-w-[150px]"
          />
          <Input
            type="password"
            value={auth.authToken}
            onChange={e => auth.setAuthToken(e.target.value)}
            placeholder="Password"
            className="max-w-[200px]"
          />
        </>
      )}

      {auth.authType === "apikey" && (
        <>
          <Input
            value={auth.authKeyName}
            onChange={e => auth.setAuthKeyName(e.target.value)}
            placeholder="Header Name (如 X-API-Key)"
            className="max-w-[180px]"
          />
          <Input
            type="password"
            value={auth.authToken}
            onChange={e => auth.setAuthToken(e.target.value)}
            placeholder="API Key"
            className="max-w-[250px]"
          />
        </>
      )}

      {auth.authType === "oauth2" && (
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={oauth2User}
            onChange={e => setOAuth2User(e.target.value)}
            placeholder="Username"
            className="w-[130px]"
          />
          <Input
            type="password"
            value={oauth2Pass}
            onChange={e => setOAuth2Pass(e.target.value)}
            placeholder="Password"
            className="w-[130px]"
          />
          <Input
            value={oauth2TokenUrl}
            onChange={e => setOAuth2TokenUrl(e.target.value)}
            placeholder="Token URL"
            className="w-[200px]"
          />
          <Button size="sm" onClick={handleOAuth2Login} disabled={auth.oauth2Loading}>
            {auth.oauth2Loading ? <Loader2 className="size-3 animate-spin" /> : null}
            登录
          </Button>
          {auth.oauth2Token && (
            <span className="text-xs text-green-500">已认证</span>
          )}
        </div>
      )}
    </div>
  )
}
