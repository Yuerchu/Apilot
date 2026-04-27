import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { Badge } from "@/components/ui/badge"
import { ArrowUp, ArrowDown, Server } from "lucide-react"
import { SchemaTree } from "@/components/schema/SchemaTree"
import type { ParsedChannel, ParsedOperation, ParsedMessage } from "@/lib/asyncapi/types"
import DOMPurify from "dompurify"
import { marked } from "marked"

export function ChannelDocTab({ channel }: { channel: ParsedChannel }) {
  const { t } = useTranslation()
  const { state } = useAsyncAPIContext()

  const descriptionHtml = useMemo(() => {
    if (!channel.description) return ""
    return DOMPurify.sanitize(marked.parse(channel.description) as string)
  }, [channel.description])

  return (
    <div className="space-y-4">
      {/* Description */}
      {descriptionHtml && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-xs"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      )}

      {/* Servers */}
      {state.servers.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Server className="size-3.5" />
            {t("channels.servers")}
          </h4>
          <div className="space-y-1">
            {state.servers.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-[11px] rounded-md border px-2.5 py-1.5">
                <Badge variant="outline" className="text-[9px]">{s.protocol}</Badge>
                <span className="font-mono text-muted-foreground">{s.url}</span>
                {s.description && <span className="text-muted-foreground">— {s.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parameters */}
      {channel.parameters.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold">{t("channels.parameters")}</h4>
          <div className="rounded-md border">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-2.5 py-1.5 font-medium">Name</th>
                  <th className="text-left px-2.5 py-1.5 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {channel.parameters.map(p => (
                  <tr key={p.name} className="border-b last:border-0">
                    <td className="px-2.5 py-1.5 font-mono">{p.name}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WS Bindings */}
      {channel.wsBindings && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold">{t("channels.bindings")}</h4>
          <pre className="text-[11px] font-mono bg-muted/30 rounded-md p-2.5 overflow-x-auto">
            {JSON.stringify(channel.wsBindings, null, 2)}
          </pre>
        </div>
      )}

      {/* Send Operations */}
      {channel.sendOperations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <ArrowUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            {t("channels.sendOps")} ({channel.sendOperations.length})
          </h4>
          {channel.sendOperations.map(op => (
            <OperationSection key={op.id} operation={op} />
          ))}
        </div>
      )}

      {/* Receive Operations */}
      {channel.receiveOperations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <ArrowDown className="size-3.5 text-blue-600 dark:text-blue-400" />
            {t("channels.receiveOps")} ({channel.receiveOperations.length})
          </h4>
          {channel.receiveOperations.map(op => (
            <OperationSection key={op.id} operation={op} />
          ))}
        </div>
      )}
    </div>
  )
}

function OperationSection({ operation }: { operation: ParsedOperation }) {
  return (
    <div className="rounded-md border">
      <div className="px-3 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[9px] ${operation.action === "send" ? "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700" : "text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700"}`}
          >
            {operation.action.toUpperCase()}
          </Badge>
          <span className="text-xs font-medium">{operation.title}</span>
        </div>
        {operation.summary && (
          <p className="text-[11px] text-muted-foreground mt-1">{operation.summary}</p>
        )}
      </div>
      <div className="px-3 py-2 space-y-2">
        {operation.messages.map(msg => (
          <MessageSection key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  )
}

function MessageSection({ message }: { message: ParsedMessage }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium">{message.title}</span>
        {message.discriminatorField && (
          <Badge variant="secondary" className="text-[9px]">
            {message.discriminatorField}{message.discriminatorValue ? `: ${message.discriminatorValue}` : ""}
          </Badge>
        )}
      </div>
      {message.summary && (
        <p className="text-[11px] text-muted-foreground">{message.summary}</p>
      )}
      {message.payload && (
        <div className="ml-2 pl-2 border-l-2 border-muted">
          <SchemaTree schema={message.payload} />
        </div>
      )}
    </div>
  )
}
