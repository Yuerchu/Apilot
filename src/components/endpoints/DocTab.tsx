import { useMemo } from "react"
import type { ParsedRoute, SchemaObject } from "@/lib/openapi/types"
import { getTypeStr } from "@/lib/openapi/type-str"
import { SchemaTree } from "@/components/schema/SchemaTree"
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

function renderMarkdownText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, "<br>")
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
        <div
          key="desc"
          className="text-sm text-muted-foreground prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdownText(route.description) }}
        />
      )
    }

    if (route.operationId) {
      sections.push(
        <p key="opid" className="mt-2 text-xs text-muted-foreground">
          Operation ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">{route.operationId}</code>
        </p>
      )
    }

    return sections
  }, [route.summary, route.description, route.operationId])

  return (
    <div className="space-y-4">
      {content}

      {route.parameters?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-primary mb-2">Parameters</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">In</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Description</TableHead>
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
                        <span
                          className="prose prose-invert prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderMarkdownText(p.description) }}
                        />
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
            Request Body
            {route.requestBody.required && (
              <span className="text-destructive ml-1 text-xs">(required)</span>
            )}
          </h4>
          {route.requestBody.description && (
            <div
              className="text-sm text-muted-foreground mb-2 prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdownText(route.requestBody.description) }}
            />
          )}
          {Object.entries(route.requestBody.content || {}).map(([mt, mo]) => (
            <div key={mt} className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">Content-Type: {mt}</p>
              {mo.schema && <SchemaTree schema={mo.schema as SchemaObject} />}
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-primary mb-2">Responses</h4>
        {Object.entries(route.responses).map(([code, resp]) => (
          <div key={code} className="mb-3">
            <div className="flex items-baseline gap-2 mb-1">
              <StatusCodeColor code={code} />
              {resp.description && (
                <span
                  className="text-sm prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownText(resp.description) }}
                />
              )}
            </div>
            {Object.entries(resp.content || {}).map(([mt, mo]) => (
              <div key={mt} className="ml-0">
                <p className="text-xs text-muted-foreground mb-1">Content-Type: {mt}</p>
                {mo.schema && <SchemaTree schema={mo.schema as SchemaObject} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
