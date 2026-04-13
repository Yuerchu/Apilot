import type { ParsedRoute } from "@/lib/openapi/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DocTab } from "./DocTab"
import { TryTab } from "./TryTab"
import { SchemaTab } from "./SchemaTab"

interface RouteDetailProps {
  route: ParsedRoute
  index: number
}

export function RouteDetail({ route, index }: RouteDetailProps) {
  return (
    <Tabs defaultValue="doc" className="mt-3">
      <TabsList className="h-8">
        <TabsTrigger value="doc" className="text-xs px-3">
          文档
        </TabsTrigger>
        <TabsTrigger value="try" className="text-xs px-3">
          测试
        </TabsTrigger>
        <TabsTrigger value="schema" className="text-xs px-3">
          Schema
        </TabsTrigger>
      </TabsList>

      <TabsContent value="doc" className="mt-3">
        <DocTab route={route} />
      </TabsContent>

      <TabsContent value="try" className="mt-3">
        <TryTab route={route} index={index} />
      </TabsContent>

      <TabsContent value="schema" className="mt-3">
        <SchemaTab route={route} index={index} />
      </TabsContent>
    </Tabs>
  )
}
