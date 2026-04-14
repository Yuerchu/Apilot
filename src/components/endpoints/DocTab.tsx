import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Database } from "lucide-react"
import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"
import { getTypeStr } from "@/lib/openapi/type-str"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { SchemaTree } from "@/components/schema/SchemaTree"
import { Markdown } from "@/components/ui/markdown"
import { Badge } from "@/components/ui/badge"
import type { MainView } from "@/lib/openapi/types"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

interface DocTabProps {
  route: ParsedRoute
}


function StatusCodeColor({ code }: { code: string }) {
  const colorClass = code.startsWith("2")
    ? "text-method-get"
    : code.startsWith("4")
      ? "text-method-patch"
      : code.startsWith("5")
        ? "text-method-delete"
        : "text-muted-foreground"

  return <span className={`font-bold text-sm ${colorClass}`}>{code}</span>
}

export function DocTab({ route }: DocTabProps) {
  const { t } = useTranslation()
  const content = useMemo(() => {
    const sections: React.ReactNode[] = []

    if (route.summary) {
      sections.push(
        <h3 key="summary" className="text-base font-semibold">
          {route.summary}
        </h3>
      )
    }

    if (route.description) {
      sections.push(
        <Markdown key="desc" className="text-sm text-muted-foreground">
          {route.description}
        </Markdown>
      )
    }

    if (route.operationId) {
      sections.push(
        <p key="opid" className="mt-2 text-xs text-muted-foreground">
          {t("doc.operationId")}: <code className="bg-muted px-1 py-0.5 rounded text-xs">{route.operationId}</code>
        </p>
      )
    }

    return sections
  }, [route.summary, route.description, route.operationId, t])

  return (
    <div className="space-y-4">
      {content}

      {route.parameters?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-primary mb-2">{t("doc.parameters")}</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t("doc.name")}</TableHead>
                <TableHead className="text-xs">{t("doc.in")}</TableHead>
                <TableHead className="text-xs">{t("doc.type")}</TableHead>
                <TableHead className="text-xs">{t("doc.description")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {route.parameters.map((p, i) => {
                const ptype = p.schema ? getTypeStr(p.schema) : (p.type || "string")
                return (
                  <TableRow key={`${p.name}-${i}`}>
                    <TableCell className="text-sm font-semibold">
                      {p.name}
                      {p.required && <span className="text-destructive ml-0.5">*</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.in}</TableCell>
                    <TableCell className="text-sm">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{ptype}</code>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.description && (
                        <Markdown className="text-xs">{p.description}</Markdown>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {route.requestBody && (
        <div>
          <h4 className="text-sm font-semibold text-primary mb-1">
            {t("doc.requestBody")}
            {route.requestBody.required && (
              <span className="text-destructive ml-1 text-xs">{t("doc.required")}</span>
            )}
          </h4>
          {route.requestBody.description && (
            <Markdown className="text-sm text-muted-foreground mb-2">
              {route.requestBody.description}
            </Markdown>
          )}
          {Object.entries(route.requestBody.content || {}).map(([mt, mo]) => (
            <div key={mt} className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">{t("doc.contentType")} {mt}</p>
              {mo.schema && <SchemaTree schema={mo.schema as SchemaObject} />}
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-primary mb-2">{t("doc.responses")}</h4>
        {Object.entries(route.responses).map(([code, resp]) => (
          <div key={code} className="mb-3">
            <div className="flex items-baseline gap-2 mb-1">
              <StatusCodeColor code={code} />
              {resp.description && (
                <Markdown className="text-sm inline">{resp.description}</Markdown>
              )}
            </div>
            {Object.entries(resp.content || {}).map(([mt, mo]) => (
              <div key={mt} className="ml-0">
                <p className="text-xs text-muted-foreground mb-1">{t("doc.contentType")} {mt}</p>
                {mo.schema && <SchemaTree schema={mo.schema as SchemaObject} />}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Referenced models */}
      {route.referencedModels.length > 0 && (
        <ReferencedModels models={route.referencedModels} />
      )}
    </div>
  )
}

function ReferencedModels({ models }: { models: string[] }) {
  const { t } = useTranslation()
  const { setMainView } = useOpenAPIContext()

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Database className="size-3.5" />
        {t("doc.relatedModels")}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {models.map(name => (
          <Badge
            key={name}
            variant="secondary"
            className="cursor-pointer hover:bg-accent text-xs"
            onClick={() => setMainView("models" as MainView)}
            title={t("doc.viewModel", { name })}
          >
            {name}
          </Badge>
        ))}
      </div>
    </div>
  )
}
