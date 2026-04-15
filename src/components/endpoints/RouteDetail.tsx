import { memo } from "react"
import { useTranslation } from "react-i18next"
import type { ParsedRoute } from "@/lib/openapi/types"
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
  return (
    <Tabs defaultValue="doc" className="mt-3">
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
