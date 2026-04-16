import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import type {
  OpenAPIDiagnosticCode,
  OpenAPIDiagnosticIssue,
  OpenAPIDiagnosticSeverity,
  OpenAPIDiffChange,
  OpenAPIDiffKind,
  OpenAPIDiffSeverity,
  OpenAPISpec,
} from "@/lib/openapi"
import {
  diffOpenAPISpecs,
  getErrorMessage,
  normalizeParsedSpec,
  parseSpecText,
  parseValidatedSpec,
  runOpenAPIDiagnostics,
} from "@/lib/openapi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ProjectToolsViewProps {
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec | null
}

interface DiffSpecSlot {
  name: string
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec
}

type DiffSlotName = "before" | "after"

const DIAGNOSTIC_ORDER: OpenAPIDiagnosticCode[] = [
  "unresolved-ref",
  "duplicate-operation-id",
  "empty-schema",
  "missing-response-schema",
  "missing-description",
  "enum-missing-description",
]

const DIFF_KIND_ORDER: OpenAPIDiffKind[] = [
  "endpoint-added",
  "endpoint-removed",
  "request-schema-changed",
  "response-schema-changed",
]

function getDiagnosticLabel(t: ReturnType<typeof useTranslation>["t"], code: OpenAPIDiagnosticCode): string {
  return t(`tools.diagnosticCodes.${code}`, code)
}

function getDiffKindLabel(t: ReturnType<typeof useTranslation>["t"], kind: OpenAPIDiffKind): string {
  return t(`tools.diffKinds.${kind}`, kind)
}

function getDiagnosticSeverityLabel(t: ReturnType<typeof useTranslation>["t"], severity: OpenAPIDiagnosticSeverity): string {
  return t(`tools.diagnosticSeverity.${severity}`, severity)
}

function getDiffSeverityLabel(t: ReturnType<typeof useTranslation>["t"], severity: OpenAPIDiffSeverity): string {
  return t(`tools.diffSeverity.${severity}`, severity)
}

function getDiagnosticBadgeVariant(severity: OpenAPIDiagnosticSeverity): "destructive" | "secondary" | "outline" {
  if (severity === "error") return "destructive"
  if (severity === "warning") return "secondary"
  return "outline"
}

function getDiffBadgeVariant(severity: OpenAPIDiffSeverity): "destructive" | "secondary" | "outline" {
  if (severity === "breaking") return "destructive"
  if (severity === "changed") return "secondary"
  return "outline"
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  )
}

function DiagnosticIssueRow({
  issue,
}: {
  issue: OpenAPIDiagnosticIssue
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={getDiagnosticBadgeVariant(issue.severity)}>
          {getDiagnosticSeverityLabel(t, issue.severity)}
        </Badge>
        <span className="text-sm font-medium">{getDiagnosticLabel(t, issue.code)}</span>
        {issue.operation && (
          <span className="font-mono text-xs text-muted-foreground">{issue.operation}</span>
        )}
        {issue.model && (
          <span className="font-mono text-xs text-muted-foreground">{issue.model}</span>
        )}
      </div>
      <div className="mt-2 min-w-0 break-all font-mono text-xs text-muted-foreground">
        {issue.location}
      </div>
    </div>
  )
}

function DiffChangeRow({ change }: { change: OpenAPIDiffChange }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={getDiffBadgeVariant(change.severity)}>
          {getDiffSeverityLabel(t, change.severity)}
        </Badge>
        <span className="text-sm font-medium">{getDiffKindLabel(t, change.kind)}</span>
        <span className="font-mono text-xs text-muted-foreground">{change.operation}</span>
      </div>
      {change.details.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {change.details.slice(0, 4).map((detail, index) => (
            <div key={`${change.id}:${index}`} className="min-w-0 break-all font-mono text-xs text-muted-foreground">
              {detail}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function parseDiffFile(file: File): Promise<DiffSpecSlot> {
  const text = await file.text()
  const parsed = parseSpecText(text)
  const { spec, sourceSpec } = await parseValidatedSpec(parsed)
  return {
    name: file.name,
    spec: normalizeParsedSpec(spec),
    sourceSpec,
  }
}

export function ProjectToolsView({ spec, sourceSpec }: ProjectToolsViewProps) {
  const { t } = useTranslation()
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)
  const [before, setBefore] = useState<DiffSpecSlot | null>(null)
  const [after, setAfter] = useState<DiffSpecSlot | null>(null)
  const [loadingSlot, setLoadingSlot] = useState<DiffSlotName | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)

  const diagnostics = useMemo(() => {
    return runOpenAPIDiagnostics(spec, sourceSpec || spec)
  }, [spec, sourceSpec])

  const diff = useMemo(() => {
    if (!before || !after) return null
    return diffOpenAPISpecs(before.spec, after.spec)
  }, [before, after])

  const currentSpecSlot = useMemo<DiffSpecSlot>(() => ({
    name: t("tools.currentSpec"),
    spec,
    sourceSpec: sourceSpec || spec,
  }), [spec, sourceSpec, t])

  const loadSlotFile = async (slot: DiffSlotName, file: File | undefined) => {
    if (!file) return
    setDiffError(null)
    setLoadingSlot(slot)
    try {
      const parsed = await parseDiffFile(file)
      if (slot === "before") setBefore(parsed)
      else setAfter(parsed)
    } catch (error) {
      setDiffError(getErrorMessage(error))
    } finally {
      setLoadingSlot(null)
    }
  }

  return (
    <Tabs defaultValue="diagnostics" className="min-h-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <TabsList>
          <TabsTrigger value="diagnostics">{t("tools.diagnostics")}</TabsTrigger>
          <TabsTrigger value="diff">{t("tools.diff")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="diagnostics" className="min-h-0 overflow-auto">
        <div className="flex flex-col gap-3 pb-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <CountTile label={t("tools.diagnosticTotal")} value={diagnostics.issues.length} />
            <CountTile label={t("tools.diagnosticSeverity.error")} value={diagnostics.counts.error} />
            <CountTile label={t("tools.diagnosticSeverity.warning")} value={diagnostics.counts.warning} />
            <CountTile label={t("tools.diagnosticSeverity.info")} value={diagnostics.counts.info} />
            <CountTile label={t("tools.endpointCount")} value={diagnostics.metrics.endpointCount} />
          </div>

          <div className="flex flex-wrap gap-2">
            {DIAGNOSTIC_ORDER.map(code => (
              <Badge key={code} variant="outline">
                {getDiagnosticLabel(t, code)}
                <span className="tabular-nums">{diagnostics.byCode[code]}</span>
              </Badge>
            ))}
          </div>

          {diagnostics.issues.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("tools.noDiagnostics")}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {diagnostics.issues.map(issue => (
                <DiagnosticIssueRow key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="diff" className="min-h-0 overflow-auto">
        <div className="flex flex-col gap-3 pb-4">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-sm font-medium">{t("tools.diffBefore")}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{before?.name || t("tools.noDiffFile")}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={beforeInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  className="hidden"
                  onChange={event => {
                    void loadSlotFile("before", event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => beforeInputRef.current?.click()}>
                  {loadingSlot === "before" && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  {t("tools.chooseFile")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setBefore(currentSpecSlot)}>
                  {t("tools.useCurrentSpec")}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <div className="text-sm font-medium">{t("tools.diffAfter")}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{after?.name || t("tools.noDiffFile")}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={afterInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  className="hidden"
                  onChange={event => {
                    void loadSlotFile("after", event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => afterInputRef.current?.click()}>
                  {loadingSlot === "after" && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  {t("tools.chooseFile")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAfter(currentSpecSlot)}>
                  {t("tools.useCurrentSpec")}
                </Button>
              </div>
            </div>
          </div>

          {diffError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {diffError}
            </div>
          )}

          {diff ? (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <CountTile label={t("tools.diffSeverity.breaking")} value={diff.counts.breaking} />
                <CountTile label={t("tools.diffKinds.endpoint-added")} value={diff.byKind["endpoint-added"]} />
                <CountTile label={t("tools.diffKinds.endpoint-removed")} value={diff.byKind["endpoint-removed"]} />
                <CountTile
                  label={t("tools.schemaChanges")}
                  value={diff.byKind["request-schema-changed"] + diff.byKind["response-schema-changed"]}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {DIFF_KIND_ORDER.map(kind => (
                  <Badge key={kind} variant="outline">
                    {getDiffKindLabel(t, kind)}
                    <span className="tabular-nums">{diff.byKind[kind]}</span>
                  </Badge>
                ))}
              </div>

              {diff.changes.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  {t("tools.noDiffChanges")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {diff.changes.map(change => (
                    <DiffChangeRow key={change.id} change={change} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={cn(
              "rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground",
              loadingSlot && "opacity-70",
            )}>
              {loadingSlot ? t("tools.loadingDiffFile") : t("tools.diffNeedsFiles")}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
