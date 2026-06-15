import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Stethoscope, GitCompare, Upload, ChevronDown, ChevronRight, Globe, FileUp, FileText } from "lucide-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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
import { getErrorMessage } from "@/lib/openapi/parser"
import { readResponseTextCapped } from "@/lib/fetch-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Collapsible, CollapsibleTrigger, AnimatedCollapsibleContent } from "@/components/ui/collapsible"
import { Toggle } from "@/components/ui/toggle"
import { useEnvironments } from "@/hooks/use-environments"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { cn } from "@/lib/utils"
import { MultiEnvDiffView } from "./MultiEnvDiffView"
import OpenAPIDiagnosticsWorker from "./openapi-diagnostics.worker.ts?worker&inline"
import OpenAPIDiffWorker from "./openapi-diff.worker.ts?worker&inline"

interface OpenAPIToolViewProps {
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec | null
}

interface OpenAPIDiffViewProps {
  spec?: OpenAPISpec | undefined
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

function DiagnosticIssueRow({ issue }: { issue: OpenAPIDiagnosticIssue }) {
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

function EndpointDiffGroup({ operation, changes }: { operation: string; changes: OpenAPIDiffChange[] }) {
  const severityCounts = useMemo(() => {
    const counts: Record<OpenAPIDiffSeverity, number> = { breaking: 0, changed: 0, "non-breaking": 0 }
    for (const c of changes) counts[c.severity]++
    return counts
  }, [changes])

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left hover:bg-accent/50 transition-colors group/trigger">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/trigger:rotate-90" />
        <span className="min-w-0 truncate font-mono text-sm font-medium">{operation}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {severityCounts.breaking > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{severityCounts.breaking}</Badge>
          )}
          {severityCounts.changed > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{severityCounts.changed}</Badge>
          )}
          {severityCounts["non-breaking"] > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{severityCounts["non-breaking"]}</Badge>
          )}
        </div>
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent>
        <div className="flex flex-col gap-1.5 pl-6 pt-1.5">
          {changes.map(change => (
            <DiffChangeRow key={change.id} change={change} />
          ))}
        </div>
      </AnimatedCollapsibleContent>
    </Collapsible>
  )
}

const SEVERITY_OPTIONS: OpenAPIDiffSeverity[] = ["breaking", "changed", "non-breaking"]

export function GroupedDiffResult({ diff }: { diff: OpenAPIDiffResult }) {
  const { t } = useTranslation()
  const [severityFilter, setSeverityFilter] = useState<Set<OpenAPIDiffSeverity>>(new Set(SEVERITY_OPTIONS))

  const grouped = useMemo(() => {
    const filtered = diff.changes.filter(c => severityFilter.has(c.severity))
    const map = new Map<string, OpenAPIDiffChange[]>()
    for (const change of filtered) {
      const key = change.operation
      const arr = map.get(key)
      if (arr) arr.push(change)
      else map.set(key, [change])
    }
    return map
  }, [diff.changes, severityFilter])

  const toggleSeverity = (severity: OpenAPIDiffSeverity) => {
    setSeverityFilter(prev => {
      const next = new Set(prev)
      if (next.has(severity)) {
        if (next.size > 1) next.delete(severity)
      } else {
        next.add(severity)
      }
      return next
    })
  }

  return (
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

      <div className="flex flex-wrap items-center gap-2">
        {SEVERITY_OPTIONS.map(severity => (
          <Toggle
            key={severity}
            size="sm"
            variant="outline"
            pressed={severityFilter.has(severity)}
            onPressedChange={() => toggleSeverity(severity)}
          >
            <Badge variant={getDiffBadgeVariant(severity)} className="pointer-events-none">
              {getDiffSeverityLabel(t, severity)}
            </Badge>
            <span className="tabular-nums text-xs">{diff.counts[severity]}</span>
          </Toggle>
        ))}
        <div className="flex-1" />
        {DIFF_KIND_ORDER.map(kind => (
          <Badge key={kind} variant="outline">
            {getDiffKindLabel(t, kind)}
            <span className="tabular-nums">{diff.byKind[kind]}</span>
          </Badge>
        ))}
      </div>

      {grouped.size === 0 ? (
        <Empty className="rounded-lg border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitCompare />
            </EmptyMedia>
            <EmptyTitle>{t("tools.noDiffChanges")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-1.5">
          {[...grouped.entries()].map(([operation, changes]) => (
            <EndpointDiffGroup key={operation} operation={operation} changes={changes} />
          ))}
        </div>
      )}
    </>
  )
}

export function getEnvSpecUrl(specUrl: string | undefined, envBaseUrl: string): string | null {
  if (!specUrl) return null
  try {
    const parsed = new URL(specUrl)
    const envBase = new URL(envBaseUrl)
    parsed.protocol = envBase.protocol
    parsed.hostname = envBase.hostname
    parsed.port = envBase.port
    const envPath = envBase.pathname.replace(/\/+$/, "")
    if (envPath && envPath !== "/") {
      parsed.pathname = envPath + parsed.pathname
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export function OpenAPIDiagnosticsView({ spec, sourceSpec }: OpenAPIToolViewProps) {
  const { t } = useTranslation()
  const diagnosticsWorkerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const pendingDiagnosticsRequestRef = useRef<number | null>(null)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-4">
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
            <Empty className="rounded-lg border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Stethoscope />
                </EmptyMedia>
                <EmptyTitle>{t("tools.noDiagnostics")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
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
  )
}

export function OpenAPIDiffView({ spec }: OpenAPIDiffViewProps) {
  const { t } = useTranslation()
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)
  const diffWorkerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const pendingSlotRequestsRef = useRef<Record<DiffSlotName, number | null>>({ before: null, after: null })
  const pendingDiffRequestRef = useRef<number | null>(null)
  const readySlotsRef = useRef<Record<DiffSlotName, boolean>>({ before: false, after: false })
  const [before, setBefore] = useState<DiffSpecSlot | null>(null)
  const [after, setAfter] = useState<DiffSpecSlot | null>(null)
  const [loadingSlot, setLoadingSlot] = useState<DiffSlotName | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [diff, setDiff] = useState<OpenAPIDiffResult | null>(null)
  const [diffComputing, setDiffComputing] = useState(false)
  const [urlInputSlot, setUrlInputSlot] = useState<DiffSlotName | null>(null)
  const [urlBefore, setUrlBefore] = useState("")
  const [urlAfter, setUrlAfter] = useState("")

  const { environments } = useEnvironments()
  const { state: { specUrl } } = useOpenAPIContext()

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

  const loadSlotFromUrl = async (slot: DiffSlotName, url: string, displayName?: string) => {
    const worker = diffWorkerRef.current
    if (!worker || !url.trim()) return
    setDiffError(null)
    setDiff(null)
    setDiffComputing(false)
    setLoadingSlot(slot)
    readySlotsRef.current[slot] = false
    const name = displayName || url
    if (slot === "before") setBefore({ name })
    else setAfter({ name })
    const requestId = ++requestIdRef.current
    pendingSlotRequestsRef.current[slot] = requestId
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      const text = await readResponseTextCapped(response)
      worker.postMessage({ type: "parse-slot", requestId, slot, name, text })
    } catch (error) {
      pendingSlotRequestsRef.current[slot] = null
      readySlotsRef.current[slot] = false
      setLoadingSlot(null)
      if (slot === "before") setBefore(null)
      else setAfter(null)
      setDiffError(getErrorMessage(error))
    }
  }

  const computeEnvSpecUrl = (envBaseUrl: string) => getEnvSpecUrl(specUrl, envBaseUrl)

  const renderSlotPanel = (slot: DiffSlotName) => {
    const slotState = slot === "before" ? before : after
    const inputRef = slot === "before" ? beforeInputRef : afterInputRef
    const slotUrl = slot === "before" ? urlBefore : urlAfter
    const setSlotUrl = slot === "before" ? setUrlBefore : setUrlAfter
    const isLoading = loadingSlot === slot
    const showUrlInput = urlInputSlot === slot

    return (
      <div className="rounded-lg border bg-card p-3">
        <div className="text-sm font-medium">{t(slot === "before" ? "tools.diffBefore" : "tools.diffAfter")}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{slotState?.name || t("tools.noDiffFile")}</div>
        <div className="mt-3 flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".json,.yaml,.yml"
            className="hidden"
            onChange={event => {
              void loadSlotFile(slot, event.target.files?.[0])
              event.target.value = ""
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={isLoading}>
                {isLoading && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {t("tools.selectSource")}
                <ChevronDown className="ml-1 size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => { setUrlInputSlot(null); inputRef.current?.click() }}>
                  <FileUp className="size-4" />
                  {t("tools.chooseFile")}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!spec} onClick={() => { setUrlInputSlot(null); setCurrentSpecForSlot(slot) }}>
                  <FileText className="size-4" />
                  {t("tools.useCurrentSpec")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setUrlInputSlot(prev => prev === slot ? null : slot)}>
                  <Globe className="size-4" />
                  {t("tools.enterUrl")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {specUrl && environments.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("tools.fromEnvironment")}</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {environments.map(env => {
                      const envUrl = computeEnvSpecUrl(env.baseUrl)
                      return (
                        <DropdownMenuItem
                          key={env.id}
                          disabled={!envUrl}
                          onClick={() => {
                            if (envUrl) {
                              setUrlInputSlot(null)
                              void loadSlotFromUrl(slot, envUrl, `${env.name} (${env.baseUrl})`)
                            }
                          }}
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm">{env.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{env.baseUrl}</span>
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {showUrlInput && (
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs"
                placeholder={t("tools.urlPlaceholder")}
                value={slotUrl}
                onChange={e => setSlotUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && slotUrl.trim()) {
                    setUrlInputSlot(null)
                    void loadSlotFromUrl(slot, slotUrl.trim())
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isLoading || !slotUrl.trim()}
                onClick={() => {
                  setUrlInputSlot(null)
                  void loadSlotFromUrl(slot, slotUrl.trim())
                }}
              >
                {t("tools.fetchUrl")}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Tabs defaultValue="pair" className="flex min-h-0 flex-1 flex-col">
      <TabsList variant="line">
        <TabsTrigger value="pair">{t("tools.pairDiff")}</TabsTrigger>
        <TabsTrigger value="multi">{t("tools.multiEnvDiff")}</TabsTrigger>
      </TabsList>
      <TabsContent value="pair" className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-4">
        <div className="grid gap-2 md:grid-cols-2">
          {renderSlotPanel("before")}
          {renderSlotPanel("after")}
        </div>

        {diffError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {diffError}
          </div>
        )}

        {diff ? (
          <GroupedDiffResult diff={diff} />
        ) : (
          <div className={cn((loadingSlot || diffComputing) && "opacity-70")}>
            {diffComputing ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                <LoadingMessage>{t("tools.computingDiff")}</LoadingMessage>
              </div>
            ) : loadingSlot ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                <LoadingMessage>{t("tools.loadingDiffFile")}</LoadingMessage>
              </div>
            ) : (
              <Empty className="rounded-lg border bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Upload />
                  </EmptyMedia>
                  <EmptyTitle>{t("tools.diffNeedsFiles")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        )}
      </TabsContent>
      <TabsContent value="multi" className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-4">
        <MultiEnvDiffView spec={spec} />
      </TabsContent>
    </Tabs>
  )
}
