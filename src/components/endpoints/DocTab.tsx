import { useMemo, memo } from "react"
import { useTranslation } from "react-i18next"
import { Database } from "lucide-react"
import type { ParsedRoute, SchemaObject, Parameter } from "@/lib/openapi/types"
import { getTypeStr } from "@/lib/openapi/type-str"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { SchemaTree } from "@/components/schema/SchemaTree"
import { Markdown } from "@/components/ui/markdown"
import { Badge } from "@/components/ui/badge"
import type { MainView } from "@/lib/openapi/types"
import { AgGridReact } from "ag-grid-react"
import type { ColDef } from "ag-grid-community"
import type { CustomCellRendererProps } from "ag-grid-react"
import { useAgGridTheme } from "./ResponseAgGrid"

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

export const DocTab = memo(function DocTab({ route }: DocTabProps) {
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
          <ParametersGrid parameters={route.parameters} />
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
})

interface ParamRow {
  name: string
  required: boolean
  in: string
  type: string
  description: string
}

function ParamNameRenderer(props: CustomCellRendererProps<ParamRow>) {
  const row = props.data
  if (!row) return null
  return (
    <div className="py-0.5">
      <span className="font-semibold font-mono">
        {row.name}
        {row.required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {row.description && (
        <div className="mt-0.5">
          <Markdown className="text-[11px] text-muted-foreground/60 leading-tight">{row.description}</Markdown>
        </div>
      )}
    </div>
  )
}

function ParamTypeRenderer(props: CustomCellRendererProps<ParamRow>) {
  const row = props.data
  if (!row) return null
  return <code className="text-xs bg-muted px-1 py-0.5 rounded">{row.type}</code>
}

const paramDefaultColDef: ColDef = {
  resizable: true,
  sortable: true,
  suppressMovable: true,
  autoHeaderHeight: true,
}

function ParametersGrid({ parameters }: { parameters: Parameter[] }) {
  const { t } = useTranslation()
  const theme = useAgGridTheme()

  const rowData = useMemo<ParamRow[]>(() =>
    parameters.map(p => ({
      name: p.name,
      required: p.required ?? false,
      in: p.in,
      type: p.schema ? getTypeStr(p.schema) : (p.type || "string"),
      description: p.description ?? "",
    })),
    [parameters],
  )

  const columnDefs = useMemo<ColDef<ParamRow>[]>(() => [
    { headerName: t("doc.name"), field: "name", cellRenderer: ParamNameRenderer, flex: 2, minWidth: 150, autoHeight: true, wrapText: true },
    { headerName: t("doc.in"), field: "in", minWidth: 70, maxWidth: 90 },
    { headerName: t("doc.type"), field: "type", cellRenderer: ParamTypeRenderer, minWidth: 100, flex: 1 },
  ], [t])

  return (
    <AgGridReact<ParamRow>
      theme={theme}
      rowData={rowData}
      columnDefs={columnDefs}
      defaultColDef={paramDefaultColDef}
      domLayout="autoHeight"
      suppressCellFocus
      suppressMovableColumns
      headerHeight={32}
    />
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
