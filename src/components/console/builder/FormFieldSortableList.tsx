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
import type { FormFieldConfig } from "@/lib/console/types"

interface FormFieldSortableListProps {
  fields: FormFieldConfig[]
  schemaProperties: Record<string, { description?: string | undefined }>
  selectedField: string | null
  onFieldsChange: (fields: FormFieldConfig[]) => void
  onSelectField: (field: string | null) => void
}

export function FormFieldSortableList({ fields, schemaProperties, selectedField, onFieldsChange, onSelectField }: FormFieldSortableListProps) {
  const { t } = useTranslation()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => fields.map(f => f.field), [fields])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = fields.findIndex(f => f.field === active.id)
    const newIndex = fields.findIndex(f => f.field === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = [...fields]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved!)
    onFieldsChange(next.map((f, i) => ({ ...f, order: i })))
  }, [fields, onFieldsChange])

  const toggleVisible = useCallback((field: string) => {
    onFieldsChange(fields.map(f => f.field === field ? { ...f, visible: !f.visible } : f))
  }, [fields, onFieldsChange])

  const selectAll = useCallback(() => {
    onFieldsChange(fields.map(f => ({ ...f, visible: true })))
  }, [fields, onFieldsChange])

  const invertSelection = useCallback(() => {
    onFieldsChange(fields.map(f => ({ ...f, visible: !f.visible })))
  }, [fields, onFieldsChange])

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5 p-2">
              {fields.map(f => {
                const prop = schemaProperties[f.field]
                const label = f.label || prop?.description || f.field
                return (
                  <SortableFieldItem
                    key={f.field}
                    id={f.field}
                    field={f.field}
                    label={label}
                    visible={f.visible}
                    selected={selectedField === f.field}
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
