import * as React from "react"
import { useTranslation } from "react-i18next"
import { format, parse } from "date-fns"
import { CalendarIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
  value: string // ISO string or empty
  onChange: (value: string) => void
  mode?: "date" | "datetime"
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  mode = "datetime",
  placeholder,
  className,
}: DateTimePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)

  // Parse value to Date
  const date = React.useMemo(() => {
    if (!value) return undefined
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  }, [value])

  // Time string
  const timeStr = React.useMemo(() => {
    if (!date) return ""
    return format(date, "HH:mm:ss")
  }, [date])

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) { onChange(""); setOpen(false); return }
    if (mode === "date") {
      onChange(format(d, "yyyy-MM-dd"))
      setOpen(false)
      return
    }
    // Keep existing time
    const existing = date || new Date()
    d.setHours(existing.getHours(), existing.getMinutes(), existing.getSeconds())
    onChange(d.toISOString())
    setOpen(false)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value
    if (!t) return
    const base = date || new Date()
    const parsed = parse(t, "HH:mm:ss", base)
    if (isNaN(parsed.getTime())) return
    onChange(parsed.toISOString())
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
  }

  const displayText = React.useMemo(() => {
    if (!date) return ""
    if (mode === "date") return format(date, "yyyy-MM-dd")
    return format(date, "yyyy-MM-dd HH:mm:ss")
  }, [date, mode])

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-mono text-xs h-8",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
            {displayText || placeholder || (mode === "date" ? t("datePicker.selectDate") : t("datePicker.selectDateTime"))}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            onSelect={handleDateSelect}
            captionLayout="dropdown"
            {...(date ? { selected: date, defaultMonth: date } : {})}
          />
          {mode === "datetime" && (
            <div className="border-t px-3 py-2">
              <Input
                type="time"
                step="1"
                value={timeStr}
                onChange={handleTimeChange}
                className="h-8 text-xs font-mono appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
      {date && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={handleClear}>
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
