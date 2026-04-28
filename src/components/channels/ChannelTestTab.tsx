import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { useWebSocket, type WsMessage } from "@/hooks/use-websocket"
import { resolveServerUrl } from "@/lib/asyncapi/parser"
import { generateExample } from "@/lib/openapi/generate-example"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plug, Unplug, Send, Trash2, ArrowUp, ArrowDown, Copy, ChevronDown, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { CodeViewer } from "@/components/editor/CodeViewer"
import type { ParsedChannel } from "@/lib/asyncapi/types"
import type { SchemaObject } from "@/lib/openapi/types"

export function ChannelTestTab({ channel }: { channel: ParsedChannel }) {
  const { t } = useTranslation()
  const { state: asyncState } = useAsyncAPIContext()
  const ws = useWebSocket()

  // Connection state
  const [serverId, setServerId] = useState(asyncState.servers[0]?.id ?? "")
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [authToken, setAuthToken] = useState("")

  // Message composer
  const sendMessages = useMemo(() => {
    return channel.sendOperations.flatMap(op => op.messages)
  }, [channel.sendOperations])

  const [selectedMsgId, setSelectedMsgId] = useState(sendMessages[0]?.id ?? "")
  const [bodyJson, setBodyJson] = useState("")
  const [dirFilter, setDirFilter] = useState<"all" | "sent" | "received">("all")
  const [autoScroll, setAutoScroll] = useState(true)

  const selectedMessage = useMemo(() => {
    return sendMessages.find(m => m.id === selectedMsgId)
  }, [sendMessages, selectedMsgId])

  // Build URL
  const buildUrl = useCallback(() => {
    const server = asyncState.servers.find(s => s.id === serverId) ?? asyncState.servers[0]
    if (!server) return ""
    let url = resolveServerUrl(server)
    let address = channel.address
    for (const [key, val] of Object.entries(pathParams)) {
      address = address.replace(`{${key}}`, encodeURIComponent(val))
    }
    url = url.replace(/\/$/, "") + address
    if (authToken) {
      url += (url.includes("?") ? "&" : "?") + `token=${encodeURIComponent(authToken)}`
    }
    return url
  }, [asyncState.servers, serverId, channel.address, pathParams, authToken])

  const handleConnect = useCallback(() => {
    const url = buildUrl()
    if (url) ws.connect(url)
  }, [buildUrl, ws])

  const handleSend = useCallback(() => {
    if (!bodyJson.trim()) return
    ws.send(bodyJson)
  }, [bodyJson, ws])

  const handleGenerateExample = useCallback(() => {
    if (!selectedMessage?.payload) return
    const example = generateExample(selectedMessage.payload as SchemaObject)
    setBodyJson(JSON.stringify(example, null, 2))
  }, [selectedMessage])

  // Auto-scroll message log
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [ws.messages.length, autoScroll])

  const filteredMessages = useMemo(() => {
    if (dirFilter === "all") return ws.messages
    return ws.messages.filter(m => m.direction === dirFilter)
  }, [ws.messages, dirFilter])

  const statusColor = ws.status === "connected" ? "bg-ws-send"
    : ws.status === "connecting" ? "bg-status-testing motion-safe:animate-pulse"
    : ws.status === "error" ? "bg-destructive"
    : "bg-muted-foreground/30"

  return (
    <div className="space-y-3">
      {/* Connection Bar */}
      <div className="space-y-2 rounded-md border p-3 bg-muted/10">
        <div className="flex items-center gap-2">
          <div className={cn("size-2.5 rounded-full shrink-0", statusColor)} />
          <span className="text-[11px] font-medium">{ws.status}</span>
          {ws.error && (
            <span className="text-[11px] text-destructive truncate">{ws.error}</span>
          )}
        </div>

        {/* Server selection */}
        {asyncState.servers.length > 1 && (
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {asyncState.servers.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.id} — {s.protocol}://{s.host}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Path parameters */}
        {channel.parameters.length > 0 && (
          <div className="space-y-1">
            {channel.parameters.map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground w-32 shrink-0 truncate">{`{${p.name}}`}</span>
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder={p.description || p.name}
                  value={pathParams[p.name] ?? ""}
                  onChange={(e) => setPathParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {/* Auth token */}
        <Input
          className="h-7 text-xs"
          placeholder="JWT Token"
          type="password"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
        />

        {/* URL preview + connect/disconnect */}
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-muted-foreground truncate flex-1">
            {buildUrl() || "ws://..."}
          </code>
          {ws.status === "disconnected" || ws.status === "error" ? (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleConnect} disabled={!buildUrl()}>
              <Plug className="size-3" />
              {t("wsTest.connect")}
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => ws.disconnect()}>
              <Unplug className="size-3" />
              {t("wsTest.disconnect")}
            </Button>
          )}
        </div>
      </div>

      {/* Message Composer */}
      <div className="space-y-2 rounded-md border p-3 bg-muted/10">
        <div className="flex items-center gap-2">
          {sendMessages.length > 1 && (
            <Select value={selectedMsgId} onValueChange={setSelectedMsgId}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder={t("wsTest.selectMessageType")} />
              </SelectTrigger>
              <SelectContent>
                {sendMessages.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.title}{m.discriminatorValue ? ` (${m.discriminatorValue})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {sendMessages.length === 1 && (
            <span className="text-xs font-medium">{sendMessages[0]?.title}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={handleGenerateExample}
            disabled={!selectedMessage?.payload}
          >
            <Sparkles className="size-3" />
            {t("wsTest.generateExample")}
          </Button>
        </div>

        <textarea
          className="w-full h-32 text-xs font-mono bg-background border rounded-md p-2 resize-y"
          value={bodyJson}
          onChange={(e) => setBodyJson(e.target.value)}
          placeholder='{"type": "..."}'
        />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleSend}
            disabled={ws.status !== "connected" || !bodyJson.trim()}
          >
            <Send className="size-3" />
            {t("wsTest.send")}
          </Button>
        </div>
      </div>

      {/* Message Log */}
      <div className="rounded-md border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
          <span className="text-[11px] font-medium">{t("wsTest.messageLog")}</span>
          <Badge variant="secondary" className="text-[9px]">{ws.messages.length}</Badge>
          <div className="flex-1" />
          <Select value={dirFilter} onValueChange={(v) => setDirFilter(v as "all" | "sent" | "received")}>
            <SelectTrigger className="h-6 w-auto text-[10px] gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t("wsTest.allMessages")}</SelectItem>
              <SelectItem value="sent" className="text-xs">{t("wsTest.sent")}</SelectItem>
              <SelectItem value="received" className="text-xs">{t("wsTest.received")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 px-1.5"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            <ChevronDown className={cn("size-3", autoScroll && "text-primary")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 px-1.5"
            onClick={ws.clearMessages}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
        <div ref={logRef} className="max-h-[400px] overflow-auto">
          {filteredMessages.length === 0 ? (
            <div className="text-[11px] text-muted-foreground text-center py-6">
              {ws.status === "connected" ? t("wsTest.noMessages") : t("wsTest.noConnection")}
            </div>
          ) : (
            filteredMessages.map(msg => (
              <MessageLogEntry key={msg.id} message={msg} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function MessageLogEntry({ message }: { message: WsMessage }) {
  const [expanded, setExpanded] = useState(false)
  const time = new Date(message.timestamp).toLocaleTimeString()

  const preview = useMemo(() => {
    if (message.parsed) {
      const str = JSON.stringify(message.parsed)
      return str.length > 120 ? str.slice(0, 120) + "..." : str
    }
    return message.body.length > 120 ? message.body.slice(0, 120) + "..." : message.body
  }, [message])

  const formattedBody = useMemo(() => {
    if (message.parsed) return JSON.stringify(message.parsed, null, 2)
    return message.body
  }, [message])

  return (
    <div
      className={cn(
        "border-b last:border-0 cursor-pointer hover:bg-muted/20 transition-colors",
        message.direction === "sent" ? "bg-ws-send/5" : "",
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        {message.direction === "sent" ? (
          <ArrowUp className="size-3 text-ws-send shrink-0" />
        ) : (
          <ArrowDown className="size-3 text-ws-receive shrink-0" />
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{time}</span>
        {message.messageType && (
          <Badge variant="secondary" className="text-[9px] shrink-0">{message.messageType}</Badge>
        )}
        <span className="text-[10px] font-mono text-muted-foreground truncate">{preview}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 ml-auto shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.writeText(formattedBody)
          }}
        >
          <Copy className="size-2.5" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t">
          <CodeViewer code={formattedBody} language="json" maxHeight="300px" />
        </div>
      )}
    </div>
  )
}
