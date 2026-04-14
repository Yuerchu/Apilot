import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { SchemaObject } from "@/lib/openapi/types"
import { resolveEffectiveSchema } from "@/lib/openapi/resolve-schema"
import { getTypeStr, getConstraints } from "@/lib/openapi/type-str"

interface SchemaTreeProps {
  schema: SchemaObject
  maxDepth?: number
}

function renderInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>")
}

function SchemaRows({
  schema,
  maxDepth,
}: {
  schema: SchemaObject
  maxDepth: number
}) {
  if (maxDepth <= 0) {
    return (
      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,2fr)] gap-x-3 py-1 px-2 text-xs text-muted-foreground">
        <div>...</div>
        <div />
        <div />
      </div>
    )
  }
  if (!schema.properties) return null

  const required = new Set(schema.required || [])

  return (
    <>
      {Object.entries(schema.properties).map(([name, prop]) => {
        const ep = resolveEffectiveSchema(prop)
        const isReq = required.has(name)
        const typeDisplay = getTypeStr(prop)
        const constraints = getConstraints(ep)
        const desc = prop.description || ep.description

        return (
          <div key={name}>
            <div className="grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,2fr)] gap-x-3 py-1.5 px-2 text-xs border-b border-border/40 hover:bg-muted/30">
              <div className="font-mono break-all">
                {name}
                {isReq && <span className="text-destructive ml-0.5">*</span>}
              </div>
              <div className="text-muted-foreground">
                <span>{typeDisplay}</span>
                {constraints && (
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {constraints.trim()}
                  </div>
                )}
              </div>
              <div className="text-muted-foreground">
                {desc && (
                  <div
                    className="[&_code]:text-[10px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted"
                    dangerouslySetInnerHTML={{ __html: renderInline(desc) }}
                  />
                )}
              </div>
            </div>
            <NestedSchema schema={ep} maxDepth={maxDepth - 1} />
          </div>
        )
      })}
    </>
  )
}

function NestedSchema({
  schema,
  maxDepth,
}: {
  schema: SchemaObject
  maxDepth: number
}) {
  if (maxDepth <= 0) return null
  if (schema._circular) {
    return (
      <div className="pl-4 py-1 text-xs text-muted-foreground italic">
        [circular: {schema._circular}]
      </div>
    )
  }

  if (schema.properties) {
    return (
      <div className="ml-3 border-l-2 border-border/50">
        <SchemaRows schema={schema} maxDepth={maxDepth} />
      </div>
    )
  }

  if (schema.type === "array" && schema.items) {
    const items = resolveEffectiveSchema(schema.items)
    if (items.properties) {
      return (
        <div className="ml-3 border-l-2 border-border/50">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/20">
            items: {getTypeStr(schema.items)}
          </div>
          <SchemaRows schema={items} maxDepth={maxDepth - 1} />
        </div>
      )
    }
    return null
  }

  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf
    const label = schema.anyOf ? "anyOf" : "oneOf"
    if (!variants) return null
    const nonNull = variants.filter(v => v.type !== "null")
    if (nonNull.length <= 1) return null

    return (
      <div className="ml-3 border-l-2 border-border/50">
        {variants.map((variant, i) => {
          const ve = resolveEffectiveSchema(variant)
          return (
            <div key={i}>
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/20">
                {label} #{i}: {getTypeStr(variant)}
              </div>
              {ve.properties && (
                <SchemaRows schema={ve} maxDepth={maxDepth - 1} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return null
}

export function SchemaTree({ schema, maxDepth = 12 }: SchemaTreeProps) {
  const { t } = useTranslation()
  const { topType, topTitle, topDesc, eff } = useMemo(() => {
    return {
      topType: getTypeStr(schema),
      topTitle: schema.title ? ` (${schema.title})` : "",
      topDesc: schema.description ? ` \u2014 ${schema.description}` : "",
      eff: resolveEffectiveSchema(schema),
    }
  }, [schema])

  return (
    <div className="rounded-md border overflow-hidden text-sm">
      <div className="px-2 py-1.5 text-xs font-medium text-foreground border-b border-border/60">
        <span className="font-mono">{topType}</span>
        {topTitle && (
          <code className="ml-1 text-[10px] px-1 py-0.5 rounded bg-muted">
            {topTitle}
          </code>
        )}
        {topDesc && (
          <span className="text-muted-foreground">{topDesc}</span>
        )}
      </div>

      {(eff.properties || eff.type === "object") && (
        <>
          <div className="grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,2fr)] gap-x-3 py-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
            <div>{t("schema.field")}</div>
            <div>{t("schema.type")}</div>
            <div>{t("schema.description")}</div>
          </div>
          <SchemaRows schema={eff} maxDepth={maxDepth} />
        </>
      )}

      {eff.type === "array" && eff.items && (() => {
        const items = resolveEffectiveSchema(eff.items)
        return (
          <>
            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/20">
              array of {getTypeStr(eff.items)}
            </div>
            {(items.properties || items.type === "object") && (
              <>
                <div className="grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,2fr)] gap-x-3 py-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
                  <div>{t("schema.field")}</div>
                  <div>{t("schema.type")}</div>
                  <div>{t("schema.description")}</div>
                </div>
                <SchemaRows schema={items} maxDepth={maxDepth - 1} />
              </>
            )}
          </>
        )
      })()}

      {!eff.properties && eff.type !== "object" && eff.type !== "array" && (eff.anyOf || eff.oneOf) && (() => {
        const variants = eff.anyOf || eff.oneOf
        const label = eff.anyOf ? "anyOf" : "oneOf"
        if (!variants) return null
        return (
          <>
            {variants.map((variant, i) => {
              const ve = resolveEffectiveSchema(variant)
              return (
                <div key={i}>
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/20">
                    {label} #{i}: {getTypeStr(variant)}
                  </div>
                  {ve.properties && (
                    <>
                      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,2fr)] gap-x-3 py-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
                        <div>Field</div>
                        <div>Type</div>
                        <div>Description</div>
                      </div>
                      <SchemaRows schema={ve} maxDepth={maxDepth - 1} />
                    </>
                  )}
                </div>
              )
            })}
          </>
        )
      })()}
    </div>
  )
}
