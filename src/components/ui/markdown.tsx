import { useMemo } from "react"
import { marked } from "marked"
import { cn } from "@/lib/utils"

marked.setOptions({
  breaks: true,
  gfm: true,
})

interface MarkdownProps {
  children: string
  className?: string
}

export function Markdown({ children, className }: MarkdownProps) {
  const html = useMemo(() => {
    try {
      return marked.parse(children) as string
    } catch {
      return children.replace(/</g, "&lt;").replace(/\n/g, "<br>")
    }
  }, [children])

  return (
    <div
      className={cn("prose prose-sm prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
