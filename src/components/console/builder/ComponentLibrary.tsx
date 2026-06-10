import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Type, AlignLeft, List, ListChecks, ToggleLeft, CircleDot,
  SlidersHorizontal, Calendar, Hash, Lock, Mail, Link, Phone,
  Upload, Palette, KeyRound,
} from "lucide-react"

interface ComponentItem {
  type: string
  label: string
  icon: React.ReactNode
  category: string
}

const COMPONENTS: ComponentItem[] = [
  { type: "input", label: "Input", icon: <Type className="size-4" />, category: "form" },
  { type: "textarea", label: "Textarea", icon: <AlignLeft className="size-4" />, category: "form" },
  { type: "number", label: "Number", icon: <Hash className="size-4" />, category: "form" },
  { type: "password", label: "Password", icon: <Lock className="size-4" />, category: "form" },
  { type: "email", label: "Email", icon: <Mail className="size-4" />, category: "form" },
  { type: "url", label: "URL", icon: <Link className="size-4" />, category: "form" },
  { type: "phone", label: "Phone", icon: <Phone className="size-4" />, category: "form" },
  { type: "select", label: "Select", icon: <List className="size-4" />, category: "form" },
  { type: "combobox", label: "Combobox", icon: <List className="size-4" />, category: "form" },
  { type: "checkbox", label: "Checkbox", icon: <ListChecks className="size-4" />, category: "form" },
  { type: "switch", label: "Switch", icon: <ToggleLeft className="size-4" />, category: "form" },
  { type: "radio", label: "Radio Group", icon: <CircleDot className="size-4" />, category: "form" },
  { type: "slider", label: "Slider", icon: <SlidersHorizontal className="size-4" />, category: "form" },
  { type: "date", label: "Date Picker", icon: <Calendar className="size-4" />, category: "form" },
  { type: "datetime", label: "DateTime", icon: <Calendar className="size-4" />, category: "form" },
  { type: "file", label: "File Upload", icon: <Upload className="size-4" />, category: "form" },
  { type: "color", label: "Color", icon: <Palette className="size-4" />, category: "form" },
  { type: "otp", label: "OTP", icon: <KeyRound className="size-4" />, category: "form" },
]

const CATEGORIES: Record<string, string> = {
  form: "Form Controls",
}

export function ComponentLibrary() {
  const grouped = COMPONENTS.reduce<Record<string, ComponentItem[]>>((acc, item) => {
    const arr = acc[item.category] ?? []
    arr.push(item)
    acc[item.category] = arr
    return acc
  }, {})

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-3">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
              {CATEGORIES[category] ?? category}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {items.map(item => (
                <div
                  key={item.type}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-transparent hover:border-border hover:bg-muted/50 cursor-default text-xs transition-colors"
                  title={item.type}
                >
                  <span className="text-muted-foreground shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
