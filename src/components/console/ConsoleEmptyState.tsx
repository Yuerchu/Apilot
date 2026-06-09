import { LayoutDashboard } from "lucide-react"

export function ConsoleEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <LayoutDashboard className="size-12 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
