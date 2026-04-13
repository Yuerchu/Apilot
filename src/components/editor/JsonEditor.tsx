import { useRef, useEffect } from "react"
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { json } from "@codemirror/lang-json"
import { oneDark } from "@codemirror/theme-one-dark"

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  minHeight?: string
}

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "12px",
    border: "none",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "'Maple Mono NF CN', 'Fira Code', 'JetBrains Mono', monospace",
  },
  ".cm-gutters": {
    border: "none",
    backgroundColor: "transparent",
  },
})

export function JsonEditor({ value, onChange, minHeight = "120px" }: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        json(),
        oneDark,
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.contentAttributes.of({ style: `min-height: ${minHeight}` }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentContent = view.state.doc.toString()
    if (value !== currentContent) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-md [&_.cm-editor]:bg-transparent"
    />
  )
}
