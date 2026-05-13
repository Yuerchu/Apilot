import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowRightLeft, Loader2, Play } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import type { OpenAPIDiffResult } from "@/lib/openapi/diff"
import type { OpenAPISpec } from "@/lib/openapi/types"
import { getErrorMessage, normalizeParsedSpec, parseSpecText, parseValidatedSpec } from "@/lib/openapi/parser"
import { useEnvironments } from "@/hooks/use-environments"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import { GroupedDiffResult, getEnvSpecUrl } from "./ProjectToolsView"
import { cn } from "@/lib/utils"
import OpenAPIDiffWorker from "./openapi-diff.worker.ts?worker&inline"

interface EnvSpec {
  key: string
  name: string
  spec: OpenAPISpec
}

interface PairDiffResult {
  fromKey: string
  toKey: string
  result: OpenAPIDiffResult
}

type MultiDiffWorkerResponse =
  | { type: "spec-stored"; requestId: number; key: string }
  | { type: "pair-diff-ready"; requestId: number; fromKey: string; toKey: string; result: OpenAPIDiffResult }
  | { type: "error"; requestId: number; message: string }

interface EnvOption {
  key: string
  name: string
  baseUrl: string
  isCurrent: boolean
}

export function MultiEnvDiffView({ spec }: { spec?: OpenAPISpec | undefined }) {
  const { t } = useTranslation()
  const { environments } = useEnvironments()
  const { state: { specUrl } } = useOpenAPIContext()

  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadPhase, setLoadPhase] = useState<"fetch" | "store" | "diff">("fetch")
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 })
  const [errors, setErrors] = useState<string[]>([])
  const [pairResults, setPairResults] = useState<PairDiffResult[]>([])
  const [activePair, setActivePair] = useState<{ from: string; to: string } | null>(null)
  const [envNames, setEnvNames] = useState<Map<string, string>>(new Map())

  // Build env options from environments + current spec
  const envOptions = useMemo((): EnvOption[] => {
    const options: EnvOption[] = []
    if (spec) {
      options.push({ key: "__current__", name: t("tools.currentSpec"), baseUrl: "", isCurrent: true })
    }
    for (const env of environments) {
      if (!specUrl || !getEnvSpecUrl(specUrl, env.baseUrl)) continue
      options.push({ key: env.id, name: env.name, baseUrl: env.baseUrl, isCurrent: false })
    }
    return options
  }, [spec, environments, specUrl, t])

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Initialize worker
  useEffect(() => {
    const worker = new OpenAPIDiffWorker()
    workerRef.current = worker
    return () => {
      workerRef.current = null
      worker.terminate()
    }
  }, [])

  const startComparison = useCallback(async () => {
    const worker = workerRef.current
    if (!worker) return

    const selected = envOptions.filter(opt => selectedKeys.has(opt.key))
    if (selected.length < 2) return

    setLoading(true)
    setErrors([])
    setPairResults([])
    setActivePair(null)
    setLoadPhase("fetch")
    setLoadProgress({ current: 0, total: selected.length })

    const names = new Map<string, string>()
    for (const opt of selected) names.set(opt.key, opt.name)
    setEnvNames(names)

    // Phase 1: Fetch & parse all specs
    const loadedSpecs: EnvSpec[] = []
    const loadErrors: string[] = []
    let loaded = 0

    const fetchPromises = selected.map(async (opt) => {
      try {
        let parsedSpec: OpenAPISpec
        if (opt.isCurrent && spec) {
          parsedSpec = spec
        } else {
          const url = getEnvSpecUrl(specUrl, opt.baseUrl)
          if (!url) throw new Error(`Cannot construct URL for ${opt.name}`)
          const response = await fetch(url)
          if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
          const text = await response.text()
          const parsed = parseSpecText(text)
          const validated = await parseValidatedSpec(parsed)
          parsedSpec = normalizeParsedSpec(validated.spec)
        }
        loadedSpecs.push({ key: opt.key, name: opt.name, spec: parsedSpec })
      } catch (error) {
        loadErrors.push(t("tools.envLoadError", { name: opt.name }) + ": " + getErrorMessage(error))
      } finally {
        loaded++
        setLoadProgress({ current: loaded, total: selected.length })
      }
    })

    await Promise.all(fetchPromises)

    if (loadErrors.length > 0) {
      setErrors(loadErrors)
    }

    if (loadedSpecs.length < 2) {
      setLoading(false)
      return
    }

    // Phase 2: Store specs in worker
    setLoadPhase("store")
    setLoadProgress({ current: 0, total: loadedSpecs.length })
    let stored = 0
    const storePromises = loadedSpecs.map(envSpec => {
      return new Promise<void>((resolve, reject) => {
        const requestId = ++requestIdRef.current
        const handler = (event: MessageEvent) => {
          const msg = event.data as MultiDiffWorkerResponse
          if (msg.requestId !== requestId) return
          worker.removeEventListener("message", handler)
          if (msg.type === "error") reject(new Error(msg.message))
          else {
            stored++
            setLoadProgress({ current: stored, total: loadedSpecs.length })
            resolve()
          }
        }
        worker.addEventListener("message", handler)
        worker.postMessage({
          type: "store-spec",
          requestId,
          key: envSpec.key,
          name: envSpec.name,
          spec: envSpec.spec,
        })
      })
    })

    try {
      await Promise.all(storePromises)
    } catch (error) {
      setErrors(prev => [...prev, getErrorMessage(error)])
      setLoading(false)
      return
    }

    // Phase 3: Compute all pairwise diffs (both directions)
    setLoadPhase("diff")
    const pairs: Array<{ from: string; to: string }> = []
    for (let i = 0; i < loadedSpecs.length; i++) {
      for (let j = 0; j < loadedSpecs.length; j++) {
        if (i !== j) pairs.push({ from: loadedSpecs[i]!.key, to: loadedSpecs[j]!.key })
      }
    }
    setLoadProgress({ current: 0, total: pairs.length })

    let diffed = 0
    const results: PairDiffResult[] = []
    const diffPromises = pairs.map(pair => {
      return new Promise<void>((resolve, reject) => {
        const requestId = ++requestIdRef.current
        const handler = (event: MessageEvent) => {
          const msg = event.data as MultiDiffWorkerResponse
          if (msg.requestId !== requestId) return
          worker.removeEventListener("message", handler)
          if (msg.type === "error") {
            reject(new Error(msg.message))
          } else if (msg.type === "pair-diff-ready") {
            results.push({ fromKey: msg.fromKey, toKey: msg.toKey, result: msg.result })
            diffed++
            setLoadProgress({ current: diffed, total: pairs.length })
            resolve()
          }
        }
        worker.addEventListener("message", handler)
        worker.postMessage({
          type: "compute-pair-diff",
          requestId,
          fromKey: pair.from,
          toKey: pair.to,
        })
      })
    })

    try {
      await Promise.all(diffPromises)
    } catch (error) {
      setErrors(prev => [...prev, getErrorMessage(error)])
    }

    setPairResults(results)
    setLoading(false)
  }, [envOptions, selectedKeys, spec, specUrl, t])

  const getDiffForPair = (fromKey: string, toKey: string): PairDiffResult | undefined => {
    return pairResults.find(r => r.fromKey === fromKey && r.toKey === toKey)
  }

  // Get unique keys that have results
  const matrixKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const r of pairResults) {
      keys.add(r.fromKey)
      keys.add(r.toKey)
    }
    return [...keys]
  }, [pairResults])

  const activeDiff = activePair ? getDiffForPair(activePair.from, activePair.to) : null

  return (
    <div className="flex flex-col gap-3">
      {/* Environment selector */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-2">
          {envOptions.map(opt => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={selectedKeys.has(opt.key)}
                onCheckedChange={() => toggleKey(opt.key)}
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{opt.name}</span>
                {opt.baseUrl && (
                  <span className="truncate text-xs text-muted-foreground">{opt.baseUrl}</span>
                )}
              </div>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            disabled={selectedKeys.size < 2 || loading}
            onClick={() => void startComparison()}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                {t(
                  loadPhase === "fetch" ? "tools.loadingEnvProgress"
                    : loadPhase === "store" ? "tools.storingEnvProgress"
                    : "tools.diffingEnvProgress",
                  loadProgress,
                )}
              </>
            ) : (
              <>
                <Play className="size-4" />
                {selectedKeys.size < 2 ? t("tools.selectEnvs") : t("tools.startCompare")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-1">
          {errors.map((err, i) => (
            <div key={i} className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {err}
            </div>
          ))}
        </div>
      )}

      {/* Matrix */}
      {pairResults.length > 0 && matrixKeys.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="relative min-w-[80px]">
                  <span className="absolute top-1 right-1.5 text-[10px] text-muted-foreground">{t("tools.matrixOldEnv")}</span>
                  <span className="absolute bottom-1 left-1.5 text-[10px] text-muted-foreground">{t("tools.matrixNewEnv")}</span>
                  <svg className="absolute inset-0 size-full pointer-events-none" preserveAspectRatio="none">
                    <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" className="text-border" strokeWidth="1" />
                  </svg>
                </TableHead>
                {matrixKeys.map(key => (
                  <TableHead key={key} className="text-center">
                    <span className="block truncate max-w-[160px]">{envNames.get(key) || key}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrixKeys.map((rowKey, rowIdx) => (
                <TableRow key={rowKey}>
                  <TableCell className="font-medium">
                    {envNames.get(rowKey) || rowKey}
                  </TableCell>
                  {matrixKeys.map((colKey, colIdx) => {
                    if (rowIdx === colIdx) {
                      return (
                        <TableCell key={colKey} className="text-center text-muted-foreground/30">—</TableCell>
                      )
                    }
                    const pair = getDiffForPair(rowKey, colKey)
                    if (!pair) {
                      return <TableCell key={colKey} className="text-center text-muted-foreground">—</TableCell>
                    }
                    const isActive = activePair?.from === rowKey && activePair?.to === colKey
                    return (
                      <TableCell key={colKey} className="p-0">
                        <button
                          type="button"
                          className={cn(
                            "flex w-full flex-col items-center gap-0.5 p-2 text-center transition-colors hover:bg-accent/50",
                            isActive && "bg-accent"
                          )}
                          onClick={() => setActivePair(isActive ? null : { from: rowKey, to: colKey })}
                        >
                          {pair.result.counts.breaking > 0 && (
                            <span className="text-sm text-destructive font-medium tabular-nums">
                              {pair.result.counts.breaking} Breaking
                            </span>
                          )}
                          <span className="text-xs tabular-nums">
                            <span className="text-success">+{pair.result.byKind["endpoint-added"]}</span>
                            {" / "}
                            <span className="text-destructive">-{pair.result.byKind["endpoint-removed"]}</span>
                            {" "}
                            <span className="text-muted-foreground">{t("tools.matrixEndpointLabel")}</span>
                          </span>
                        </button>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Active pair detail */}
      {activePair && activeDiff && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span>
              {t("tools.comparingPair", {
                from: envNames.get(activePair.from) || activePair.from,
                to: envNames.get(activePair.to) || activePair.to,
              })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="size-7 p-0"
              onClick={() => setActivePair({ from: activePair.to, to: activePair.from })}
            >
              <ArrowRightLeft className="size-3.5" />
            </Button>
          </div>
          <GroupedDiffResult diff={activeDiff.result} />
        </div>
      )}
    </div>
  )
}
