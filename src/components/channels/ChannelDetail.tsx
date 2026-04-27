import { useTranslation } from "react-i18next"
import { useAsyncAPIContext } from "@/contexts/AsyncAPIContext"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ChannelDocTab } from "./ChannelDocTab"
import { ChannelTestTab } from "./ChannelTestTab"
import type { ParsedChannel } from "@/lib/asyncapi/types"
import type { ChannelDetailTab } from "@/lib/openapi/types"

export function ChannelDetail({ channel }: { channel: ParsedChannel }) {
  const { t } = useTranslation()
  const { state, setChannelDetailTab } = useAsyncAPIContext()

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">{channel.title}</h3>
        <span className="text-xs font-mono text-muted-foreground">{channel.address}</span>
      </div>
      <Tabs
        value={state.channelDetailTab}
        onValueChange={(v) => setChannelDetailTab(v as ChannelDetailTab)}
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
          <TabsTrigger value="doc" className="text-xs">{t("doc.tabs.doc")}</TabsTrigger>
          <TabsTrigger value="test" className="text-xs">{t("wsTest.title")}</TabsTrigger>
        </TabsList>
        <TabsContent value="doc" className="px-4 py-3 mt-0">
          <ChannelDocTab channel={channel} />
        </TabsContent>
        <TabsContent value="test" className="px-4 py-3 mt-0">
          <ChannelTestTab channel={channel} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
