import { memo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { json } from "@codemirror/lang-json"
import { python } from "@codemirror/lang-python"
import { javascript } from "@codemirror/lang-javascript"
import { java } from "@codemirror/lang-java"
import { php } from "@codemirror/lang-php"
import { go } from "@codemirror/lang-go"
import { rust } from "@codemirror/lang-rust"
import { cpp } from "@codemirror/lang-cpp"
import type { Extension } from "@codemirror/state"

const theme = EditorView.theme({
  "&": { fontSize: "12px" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
  },
  ".cm-gutters": { display: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
})

function getLangExtension(lang: string): Extension {
  switch (lang) {
    case "json": return json()
    case "python": return python()
    case "javascript":
    case "node": return javascript()
    case "java":
    case "kotlin": return java()
    case "php": return php()
    case "go": return go()
    case "rust": return rust()
    case "c":
    case "csharp":
    case "cpp":
    case "objc": return cpp()
    default: return []
  }
}

interface CodeViewerProps {
  code: string
  language?: string
  maxHeight?: string
}

export const CodeViewer = memo(function CodeViewer({
  code,
  language = "shell",
  maxHeight = "200px",
}: CodeViewerProps) {
  return (
    <CodeMirror
      value={code}
      readOnly
      editable={false}
      extensions={[getLangExtension(language), theme]}
      theme={oneDark}
      maxHeight={maxHeight}
      basicSetup={{
        lineNumbers: false,
        highlightActiveLine: false,
        foldGutter: false,
      }}
      className="[&_.cm-editor]:bg-transparent [&_.cm-cursor]:hidden"
    />
  )
})
