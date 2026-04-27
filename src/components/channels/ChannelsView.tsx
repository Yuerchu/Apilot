import { useState, useMemo, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { ChannelDetail } from "./ChannelDetail"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CopyButton } from "@/components/animate-ui/components/buttons/copy"
import { Search, Radio, ArrowUp, ArrowDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatMarkdownChannel } from "@/lib/format-route"
import type { ParsedChannel } from "@/lib/asyncapi/types"

export function ChannelsView() {
  const { t } = useTranslation()
  const { state, setActiveChannelId } = useAsyncAPIContext()
  const [filter, setFilter] = useState("")
  const parentRef = useRef<HTMLDivElement>(null)

  const filteredChannels = useMemo(() => {
    if (!filter) return state.channels
    const lower = filter.toLowerCase()
    return state.channels.filter(ch => {
      const haystack = `${ch.id} ${ch.address} ${ch.title} ${ch.description}`.toLowerCase()
      return haystack.includes(lower)
    })
  }, [state.channels, filter])

  const virtualizer = useVirtualizer({
    count: filteredChannels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  const activeChannel = useMemo(() => {
    return state.channels.find(ch => ch.id === state.activeChannelId)
  }, [state.channels, state.activeChannelId])

  const handleChannelClick = useCallback((ch: ParsedChannel) => {
    setActiveChannelId(ch.id === state.activeChannelId ? "" : ch.id)
  }, [state.activeChannelId, setActiveChannelId])

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Radio className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{t("sidebar.channels")}</span>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("channels.search")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-1 gap-3 min-h-0">
        {/* Channel list */}
        <div ref={parentRef} className="overflow-auto flex-1 min-w-[300px] max-w-[480px]">
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {virtualizer.getVirtualItems().map(virtualItem => {
              const ch = filteredChannels[virtualItem.index]!
              const isActive = ch.id === state.activeChannelId
              return (
                <div
                  key={ch.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <ChannelCard
                    channel={ch}
                    isActive={isActive}
                    onClick={() => handleChannelClick(ch)}
                  />
                </div>
              )
            })}
          </div>
          {filteredChannels.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t("channels.noMatch")}
            </div>
          )}
        </div>

        {/* Channel detail panel */}
        {activeChannel && (
          <div className="flex-1 min-w-0 overflow-auto">
            <ChannelDetail channel={activeChannel} />
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelCard({ channel, isActive, onClick }: {
  channel: ParsedChannel
  isActive: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const sendCount = channel.sendOperations.length
  const recvCount = channel.receiveOperations.length
  const copyText = useMemo(() => formatMarkdownChannel(channel), [channel])

  return (
    <div
      className={cn(
        "rounded-lg border bg-card cursor-pointer transition-colors mb-1.5",
        isActive ? "border-primary/50 bg-primary/5" : "hover:bg-accent/30",
      )}
      onClick={onClick}
    >
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono shrink-0">WS</Badge>
          <span className="text-xs font-medium truncate">{channel.title}</span>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <CopyButton
              variant="ghost"
              size="sm"
              className="size-6 p-0"
              content={copyText}
              onClick={(e) => e.stopPropagation()}
              onCopiedChange={(copied) => {
                if (copied) toast.success(t("toast.copied"))
              }}
            />
            <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", isActive && "rotate-90")} />
          </div>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground truncate">
          {channel.address}
        </div>
        <div className="flex items-center gap-2">
          {sendCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
              <ArrowUp className="size-3" />
              {sendCount} send
            </span>
          )}
          {recvCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400">
              <ArrowDown className="size-3" />
              {recvCount} receive
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
