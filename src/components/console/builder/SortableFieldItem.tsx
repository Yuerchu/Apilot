import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface SortableFieldItemProps {
  id: string
  field: string
  label: string
  visible: boolean
  selected: boolean
  onToggleVisible: (field: string) => void
  onSelect: (field: string) => void
}

export function SortableFieldItem({ id, field, label, visible, selected, onToggleVisible, onSelect }: SortableFieldItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm border border-transparent transition-colors",
        isDragging && "opacity-50 bg-muted",
        selected && !isDragging && "border-primary/50 bg-primary/5",
        !selected && !isDragging && "hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <Checkbox
        checked={visible}
        onCheckedChange={() => onToggleVisible(field)}
        className="shrink-0"
      />
      <button
        type="button"
        className="flex-1 text-left min-w-0 truncate"
        onClick={() => onSelect(field)}
      >
        <span className="font-mono text-xs">{field}</span>
        {label !== field && (
          <span className="ml-1.5 text-muted-foreground text-xs">{label}</span>
        )}
      </button>
    </div>
  )
}
