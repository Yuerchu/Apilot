import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useOpenAPIContext } from "@/contexts/OpenAPIContext"
import type { SchemaObject, OpenAPISpec } from "@/lib/openapi/types"
import { ModelCard } from "@/components/models/ModelCard"
import { ModelGraphView } from "@/components/models/ModelGraphView"
import { ViewToolbar } from "@/components/layout/ViewToolbar"
import { Button } from "@/components/ui/button"

interface ModelsViewProps {
  spec: OpenAPISpec
  sourceSpec: OpenAPISpec | null
}

export function ModelsView({ spec, sourceSpec }: ModelsViewProps) {
  const { t } = useTranslation()
  const {
    state,
    toggleModel,
    selectAllModels,
    clearModelSelection,
    setActiveModelName,
    setModelFilter,
    setModelViewMode,
  } = useOpenAPIContext()
  const selectedModels = state.selectedModels
  const filter = state.modelFilter
  const viewMode = state.modelViewMode
  const [graphMounted, setGraphMounted] = useState(false)

  const schemas = useMemo(() => {
    return spec.components?.schemas || spec.definitions || {}
  }, [spec]) as Record<string, SchemaObject>

  const graphSchemas = useMemo(() => {
    return sourceSpec?.components?.schemas || sourceSpec?.definitions || schemas
  }, [sourceSpec, schemas]) as Record<string, SchemaObject>

  const sortedNames = useMemo(() => {
    return Object.keys(schemas).sort()
  }, [schemas])

  const filteredNames = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return sortedNames
    return sortedNames.filter(name => name.toLowerCase().includes(q))
  }, [sortedNames, filter])

  const activeModelIndex = useMemo(() => {
    if (!state.activeModelName) return -1
    return filteredNames.indexOf(state.activeModelName)
  }, [filteredNames, state.activeModelName])

  const handleSelectChange = useCallback((name: string) => {
    toggleModel(name)
  }, [toggleModel])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      selectAllModels(filteredNames)
    } else {
      clearModelSelection()
    }
  }, [filteredNames, selectAllModels, clearModelSelection])

  const handleShowGraph = useCallback(() => {
    setGraphMounted(true)
    setModelViewMode("graph")
  }, [setModelViewMode])

  const masterChecked = filteredNames.length > 0 && filteredNames.every(n => selectedModels.has(n))
  const masterIndeterminate = !masterChecked && filteredNames.some(n => selectedModels.has(n))


  // Virtual list
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filteredNames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  })

  useEffect(() => {
    if (viewMode !== "list" || activeModelIndex < 0) return
    virtualizer.scrollToIndex(activeModelIndex, { align: "center" })
  }, [activeModelIndex, viewMode, virtualizer])

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <ViewToolbar
        selectAllChecked={masterIndeterminate ? "indeterminate" : masterChecked}
        onSelectAllChange={v => handleSelectAll(v === true)}
        searchPlaceholder={t("models.search")}
        filter={filter}
        onFilterChange={setModelFilter}
        totalCount={filteredNames.length}
        totalLabel={t("unit.modelCount")}
        selectedCount={selectedModels.size}
      >
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
          <Button
            type="button"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setModelViewMode("list")}
          >
            {t("models.listView", "List")}
          </Button>
          <Button
            type="button"
            variant={viewMode === "graph" ? "secondary" : "ghost"}
            size="xs"
            onClick={handleShowGraph}
          >
            {t("models.graphView", "Graph")}
          </Button>
        </div>
      </ViewToolbar>

      {/* Virtualized model list */}
      <div
        ref={parentRef}
        className={viewMode === "list" ? "min-h-0 flex-1 overflow-auto" : "hidden"}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const name = filteredNames[virtualRow.index]
            if (name === undefined) return null
            const schema = schemas[name]
            if (!schema) return null
            return (
              <div
                key={name}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="pb-2">
                  <ModelCard
                    name={name}
                    schema={schema}
                    selected={selectedModels.has(name)}
                    open={state.activeModelName === name}
                    onSelectChange={() => handleSelectChange(name)}
                    onOpenChange={open => setActiveModelName(open ? name : "")}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {filteredNames.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {filter ? t("models.noMatch") : t("models.noModels")}
          </div>
        )}
      </div>

      {(graphMounted || viewMode === "graph") && (
        <div className={viewMode === "graph" ? "flex min-h-0 flex-1" : "hidden"}>
          <ModelGraphView
            schemas={graphSchemas}
            filter={filter}
            selectedModels={selectedModels}
            modelRouteMap={state.modelRouteMap}
          />
        </div>
      )}
    </div>
  )
}
