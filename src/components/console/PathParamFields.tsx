import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import type { ParsedRoute, Parameter } from "@/lib/openapi/types"

/** Path (`in: "path"`) parameters declared on a route, e.g. {id} in /users/{id}. */
export function getPathParams(route: ParsedRoute): Parameter[] {
  return (route.parameters ?? []).filter(p => p.in === "path")
}

/** True if every required path parameter has a non-empty value. */
export function hasAllRequiredPathParams(route: ParsedRoute, values: Record<string, string>): boolean {
  return getPathParams(route).every(p => !p.required || !!values[p.name]?.trim())
}

/**
 * Inline editor for a route's path parameters with an optional "load" action.
 * Detail/editor/config/stats templates render this so a resource whose read
 * operation needs an id (GET /users/{id}) is actually usable instead of silently
 * blank. Renders nothing when the route has no path parameters.
 */
export function PathParamFields({
  route, values, onChange, onLoad, loading, loadLabel,
}: {
  route: ParsedRoute
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
  onLoad?: () => void
  loading?: boolean
  loadLabel?: string
}) {
  const { t } = useTranslation()
  const params = getPathParams(route)
  if (params.length === 0) return null
  const ready = hasAllRequiredPathParams(route, values)
  return (
    <div className="flex flex-wrap items-end gap-2">
      {params.map(p => (
        <Field key={p.name} className="w-44">
          <FieldLabel htmlFor={`pp-${p.name}`} className="text-xs">
            {p.name}{p.required ? " *" : ""}
          </FieldLabel>
          <Input
            id={`pp-${p.name}`}
            className="h-8 text-xs font-mono"
            value={values[p.name] ?? ""}
            placeholder={p.name}
            onChange={e => onChange({ ...values, [p.name]: e.target.value })}
            onKeyDown={e => { if (e.key === "Enter" && ready && onLoad) onLoad() }}
          />
        </Field>
      ))}
      {onLoad && (
        <Button size="sm" className="h-8" onClick={onLoad} disabled={!ready || loading}>
          {loadLabel ?? t("console.load")}
        </Button>
      )}
    </div>
  )
}
