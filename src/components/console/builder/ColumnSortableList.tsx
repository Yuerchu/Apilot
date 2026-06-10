import { useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SortableFieldItem } from "./SortableFieldItem"
import type { ColumnConfig } from "@/lib/console/types"
import type { FieldMeta } from "@/components/endpoints/ResponseTableView"

interface ColumnSortableListProps {
  columns: ColumnConfig[]
  fieldMap: Map<string, FieldMeta>
  selectedField: string | null
  onColumnsChange: (columns: ColumnConfig[]) => void
  onSelectField: (field: string | null) => void
}

export function ColumnSortableList({ columns, fieldMap, selectedField, onColumnsChange, onSelectField }: ColumnSortableListProps) {
  const { t } = useTranslation()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => columns.map(c => c.field), [columns])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = columns.findIndex(c => c.field === active.id)
    const newIndex = columns.findIndex(c => c.field === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = [...columns]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved!)
    onColumnsChange(next.map((c, i) => ({ ...c, order: i })))
  }, [columns, onColumnsChange])

  const toggleVisible = useCallback((field: string) => {
    onColumnsChange(columns.map(c => c.field === field ? { ...c, visible: !c.visible } : c))
  }, [columns, onColumnsChange])

  const selectAll = useCallback(() => {
    onColumnsChange(columns.map(c => ({ ...c, visible: true })))
  }, [columns, onColumnsChange])

  const invertSelection = useCallback(() => {
    onColumnsChange(columns.map(c => ({ ...c, visible: !c.visible })))
  }, [columns, onColumnsChange])

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5 p-2">
              {columns.map(col => {
                const meta = fieldMap.get(col.field)
                const label = col.headerLabel || meta?.description || col.field
                return (
                  <SortableFieldItem
                    key={col.field}
                    id={col.field}
                    field={col.field}
                    label={label}
                    visible={col.visible}
                    selected={selectedField === col.field}
                    onToggleVisible={toggleVisible}
                    onSelect={onSelectField}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>
      <div className="flex gap-2 p-2 border-t">
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={selectAll}>
          {t("schemaForm.selectAll")}
        </Button>
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={invertSelection}>
          {t("schemaForm.invert")}
        </Button>
      </div>
    </div>
  )
}
