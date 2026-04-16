import { memo } from "react"
import { useTranslation } from "react-i18next"
import type { EndpointDetailTab, ParsedRoute } from "@/lib/openapi/types"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
} from "@/components/animate-ui/primitives/radix/tabs"
import { DocTab } from "./DocTab"
import { TryTab } from "./TryTab"

interface RouteDetailProps {
  route: ParsedRoute
  index: number
}

const tabTriggerClass = "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"

export const RouteDetail = memo(function RouteDetail({ route, index }: RouteDetailProps) {
  const { t } = useTranslation()
  const { state, setEndpointDetailTab } = useOpenAPIContext()
  return (
    <Tabs
      value={state.endpointDetailTab}
      onValueChange={value => setEndpointDetailTab(value as EndpointDetailTab)}
      className="mt-3"
    >
      <TabsList className="inline-flex h-8 items-center rounded-md bg-muted p-1 text-muted-foreground">
        <TabsTrigger value="doc" className={tabTriggerClass}>
          {t("doc.tabs.doc")}
        </TabsTrigger>
        <TabsTrigger value="try" className={tabTriggerClass}>
          {t("doc.tabs.test")}
        </TabsTrigger>
      </TabsList>

      <TabsContents className="mt-3">
        <TabsContent value="doc">
          <DocTab route={route} />
        </TabsContent>

        <TabsContent value="try">
          <TryTab route={route} index={index} />
        </TabsContent>
      </TabsContents>
    </Tabs>
  )
})
