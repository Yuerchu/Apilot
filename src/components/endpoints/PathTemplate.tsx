import { memo } from "react"
import { cn } from "@/lib/utils"

type PathTemplatePart =
  | {
      type: "text"
      value: string
    }
  | {
      type: "parameter"
      value: string
    }

interface PathTemplateProps {
  path: string
  className?: string
}


function splitPathTemplate(path: string): PathTemplatePart[] {
  const parts: PathTemplatePart[] = []
  let cursor = 0

  while (cursor < path.length) {
    const open = path.indexOf("{", cursor)
    if (open === -1) {
      parts.push({ type: "text", value: path.slice(cursor) })
      break
    }

    if (open > cursor) {
      parts.push({ type: "text", value: path.slice(cursor, open) })
    }

    const close = path.indexOf("}", open + 1)
    if (close === -1 || close === open + 1) {
      parts.push({ type: "text", value: path.slice(open) })
      break
    }

    parts.push({ type: "parameter", value: path.slice(open, close + 1) })
    cursor = close + 1
  }

  return parts
}

export const PathTemplate = memo(function PathTemplate({ path, className }: PathTemplateProps) {
  const parts = splitPathTemplate(path)

  return (
    <span
      className={cn("block min-w-0 truncate text-sm font-medium font-mono", className)}
      title={path}
    >
      {parts.map((part, index) => {
        if (part.type === "parameter") {
          return (
            <span
              key={`${index}:parameter`}
              className="mx-0.5 rounded border bg-muted/60 px-1 py-0.5 text-[0.92em] text-foreground"
            >
              {part.value}
            </span>
          )
        }

        // Split text on "/" to dim the slashes
        const segments = part.value.split("/")
        return (
          <span key={`${index}:text`}>
            {segments.map((seg, si) => (
              <span key={si}>
                {si > 0 && <span className="text-muted-foreground/50">/</span>}
                {seg}
              </span>
            ))}
          </span>
        )
      })}
    </span>
  )
})
