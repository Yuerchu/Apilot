import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import type {
  OpenAPIDiagnosticCode,
  OpenAPIDiagnosticIssue,
  OpenAPIDiagnosticSeverity,
  OpenAPIDiagnosticsResult,
} from "@/lib/openapi/diagnostics"
import type {
  OpenAPIDiffChange,
  OpenAPIDiffKind,
  OpenAPIDiffResult,
  OpenAPIDiffSeverity,
} from "@/lib/openapi/diff"
import type { OpenAPISpec } from "@/lib/openapi/types"
import type { ToolsViewTab } from "@/lib/openapi/types"
import { getErrorMessage } from "@/lib/openapi/parser"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import OpenAPIDiagnosticsWorker from "./openapi-diagnostics.worker.ts?worker&inline"
import OpenAPIDiffWorker from "./openapi-diff.worker.ts?worker&inline"

interface ProjectToolsViewProps {
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec | null
}

interface DiffSpecSlot {
  name: string
}

type DiffSlotName = "before" | "after"

type DiagnosticsWorkerResponse =
  | {
      type: "diagnostics-ready"
      requestId: number
      result: OpenAPIDiagnosticsResult
    }
  | {
      type: "error"
      requestId: number
      message: string
    }

type DiffWorkerResponse =
  | {
      type: "slot-ready"
      requestId: number
      slot: DiffSlotName
      name: string
    }
  | {
      type: "diff-ready"
      requestId: number
      result: OpenAPIDiffResult
    }
  | {
      type: "error"
      requestId: number
      message: string
      slot?: DiffSlotName
    }

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
    <div className="min-w-0 rounded-lg border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  )
}

function TruncatedCode({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn("block min-w-0 max-w-full truncate font-mono text-xs text-muted-foreground", className)}
      title={value}
      aria-label={value}
    >
      {value}
    </span>
  )
}

function LoadingMessage({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-center gap-2" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{children}</span>
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
    <div className="min-w-0 overflow-hidden rounded-lg border bg-card p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
        <Badge variant={getDiagnosticBadgeVariant(issue.severity)}>
          {getDiagnosticSeverityLabel(t, issue.severity)}
        </Badge>
        <span className="min-w-0 truncate text-sm font-medium">{getDiagnosticLabel(t, issue.code)}</span>
        {issue.operation && (
          <TruncatedCode value={issue.operation} className="max-w-[280px]" />
        )}
        {issue.model && (
          <TruncatedCode value={issue.model} className="max-w-[360px]" />
        )}
      </div>
      <div className="mt-2 min-w-0 rounded-md bg-muted/30 px-2 py-1">
        <TruncatedCode value={issue.location} />
      </div>
    </div>
  )
}

function DiffChangeRow({ change }: { change: OpenAPIDiffChange }) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-card p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
        <Badge variant={getDiffBadgeVariant(change.severity)}>
          {getDiffSeverityLabel(t, change.severity)}
        </Badge>
        <span className="min-w-0 truncate text-sm font-medium">{getDiffKindLabel(t, change.kind)}</span>
        <TruncatedCode value={change.operation} className="max-w-[320px]" />
      </div>
      {change.details.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {change.details.slice(0, 4).map((detail, index) => (
            <div key={`${change.id}:${index}`} className="min-w-0 rounded-md bg-muted/30 px-2 py-1">
              <TruncatedCode value={detail} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjectToolsView({ spec, sourceSpec }: ProjectToolsViewProps) {
  const { t } = useTranslation()
  const { state, setToolsTab } = useOpenAPIContext()
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)
  const diagnosticsWorkerRef = useRef<Worker | null>(null)
  const diffWorkerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const pendingDiagnosticsRequestRef = useRef<number | null>(null)
  const pendingSlotRequestsRef = useRef<Record<DiffSlotName, number | null>>({ before: null, after: null })
  const pendingDiffRequestRef = useRef<number | null>(null)
  const readySlotsRef = useRef<Record<DiffSlotName, boolean>>({ before: false, after: false })
  const [before, setBefore] = useState<DiffSpecSlot | null>(null)
  const [after, setAfter] = useState<DiffSpecSlot | null>(null)
  const [loadingSlot, setLoadingSlot] = useState<DiffSlotName | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [diff, setDiff] = useState<OpenAPIDiffResult | null>(null)
  const [diffComputing, setDiffComputing] = useState(false)
  const [diagnostics, setDiagnostics] = useState<OpenAPIDiagnosticsResult | null>(null)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)

  useEffect(() => {
    const worker = new OpenAPIDiagnosticsWorker()
    diagnosticsWorkerRef.current = worker

    worker.onmessage = event => {
      const message = event.data as DiagnosticsWorkerResponse
      if (pendingDiagnosticsRequestRef.current !== message.requestId) return
      pendingDiagnosticsRequestRef.current = null

      if (message.type === "diagnostics-ready") {
        setDiagnostics(message.result)
        setDiagnosticsError(null)
        return
      }

      setDiagnosticsError(message.message)
    }

    return () => {
      diagnosticsWorkerRef.current = null
      worker.terminate()
    }
  }, [])

  useEffect(() => {
    const worker = diagnosticsWorkerRef.current
    if (!worker) return
    const requestId = ++requestIdRef.current
    pendingDiagnosticsRequestRef.current = requestId
    queueMicrotask(() => {
      if (pendingDiagnosticsRequestRef.current !== requestId) return
      setDiagnostics(null)
      setDiagnosticsError(null)
    })
    worker.postMessage({
      type: "run-diagnostics",
      requestId,
      spec,
      sourceSpec: sourceSpec || spec,
    })
  }, [spec, sourceSpec])

  const startDiffCompute = useCallback(() => {
    const worker = diffWorkerRef.current
    if (!worker) return
    if (!readySlotsRef.current.before || !readySlotsRef.current.after) return
    const requestId = ++requestIdRef.current
    pendingDiffRequestRef.current = requestId
    setDiff(null)
    setDiffError(null)
    setDiffComputing(true)
    worker.postMessage({ type: "compute-diff", requestId })
  }, [])

  useEffect(() => {
    const worker = new OpenAPIDiffWorker()
    diffWorkerRef.current = worker

    worker.onmessage = event => {
      const message = event.data as DiffWorkerResponse

      if (message.type === "slot-ready") {
        if (pendingSlotRequestsRef.current[message.slot] !== message.requestId) return
        pendingSlotRequestsRef.current[message.slot] = null
        readySlotsRef.current[message.slot] = true
        setLoadingSlot(current => current === message.slot ? null : current)
        if (message.slot === "before") setBefore({ name: message.name })
        else setAfter({ name: message.name })
        startDiffCompute()
        return
      }

      if (message.type === "diff-ready") {
        if (pendingDiffRequestRef.current !== message.requestId) return
        pendingDiffRequestRef.current = null
        setDiff(message.result)
        setDiffComputing(false)
        return
      }

      if (message.slot) {
        if (pendingSlotRequestsRef.current[message.slot] !== message.requestId) return
        pendingSlotRequestsRef.current[message.slot] = null
        readySlotsRef.current[message.slot] = false
        setLoadingSlot(current => current === message.slot ? null : current)
        if (message.slot === "before") setBefore(null)
        else setAfter(null)
      } else {
        if (pendingDiffRequestRef.current !== message.requestId) return
        pendingDiffRequestRef.current = null
        setDiffComputing(false)
      }
      setDiffError(message.message)
    }

    return () => {
      diffWorkerRef.current = null
      worker.terminate()
    }
  }, [startDiffCompute])

  const loadSlotFile = async (slot: DiffSlotName, file: File | undefined) => {
    const worker = diffWorkerRef.current
    if (!worker) return
    if (!file) return
    setDiffError(null)
    setDiff(null)
    setDiffComputing(false)
    setLoadingSlot(slot)
    readySlotsRef.current[slot] = false
    if (slot === "before") setBefore({ name: file.name })
    else setAfter({ name: file.name })
    const requestId = ++requestIdRef.current
    pendingSlotRequestsRef.current[slot] = requestId
    try {
      const text = await file.text()
      worker.postMessage({
        type: "parse-slot",
        requestId,
        slot,
        name: file.name,
        text,
      })
    } catch (error) {
      pendingSlotRequestsRef.current[slot] = null
      setDiffError(getErrorMessage(error))
      setLoadingSlot(null)
    }
  }

  const setCurrentSpecForSlot = (slot: DiffSlotName) => {
    const worker = diffWorkerRef.current
    if (!worker) return
    const currentSpecSlot = { name: t("tools.currentSpec") }
    const requestId = ++requestIdRef.current
    pendingSlotRequestsRef.current[slot] = requestId
    setDiffError(null)
    setDiff(null)
    setDiffComputing(false)
    setLoadingSlot(slot)
    readySlotsRef.current[slot] = false
    if (slot === "before") setBefore(currentSpecSlot)
    else setAfter(currentSpecSlot)
    worker.postMessage({
      type: "set-slot",
      requestId,
      slot,
      name: currentSpecSlot.name,
      spec,
    })
  }

  return (
    <Tabs
      value={state.toolsTab}
      onValueChange={value => setToolsTab(value as ToolsViewTab)}
      className="min-h-0 flex-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <TabsList>
          <TabsTrigger value="diagnostics">{t("tools.diagnostics")}</TabsTrigger>
          <TabsTrigger value="diff">{t("tools.diff")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="diagnostics" className="min-h-0 overflow-auto">
        <div className="flex flex-col gap-3 pb-4">
          {diagnosticsError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {diagnosticsError}
            </div>
          )}

          {!diagnostics ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              <LoadingMessage>{t("tools.loadingDiagnostics")}</LoadingMessage>
            </div>
          ) : (
            <>
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
            </>
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loadingSlot === "before"}
                  onClick={() => beforeInputRef.current?.click()}
                >
                  {loadingSlot === "before" && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  {t("tools.chooseFile")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={loadingSlot === "before"}
                  onClick={() => setCurrentSpecForSlot("before")}
                >
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loadingSlot === "after"}
                  onClick={() => afterInputRef.current?.click()}
                >
                  {loadingSlot === "after" && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  {t("tools.chooseFile")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={loadingSlot === "after"}
                  onClick={() => setCurrentSpecForSlot("after")}
                >
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
              (loadingSlot || diffComputing) && "opacity-70",
            )}>
              {diffComputing
                ? <LoadingMessage>{t("tools.computingDiff")}</LoadingMessage>
                : loadingSlot
                  ? <LoadingMessage>{t("tools.loadingDiffFile")}</LoadingMessage>
                  : t("tools.diffNeedsFiles")}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
