import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
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
      const raw = marked.parse(children) as string
      return DOMPurify.sanitize(raw)
    } catch {
      return DOMPurify.sanitize(children.replace(/</g, "&lt;").replace(/\n/g, "<br>"))
    }
  }, [children])

  return (
    <div
      className={cn("prose prose-sm prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
