import CodeMirror from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  minHeight?: string
}

const theme = EditorView.theme({
  "&": { fontSize: "12px" },
  ".cm-scroller": {
    fontFamily: "'Maple Mono NF CN', 'JetBrains Mono', 'Fira Code', monospace",
  },
  ".cm-gutters": {
    border: "none",
    backgroundColor: "transparent",
  },
})

export function JsonEditor({ value, onChange, minHeight = "120px" }: JsonEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[json(), theme]}
      theme={oneDark}
      minHeight={minHeight}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        foldGutter: true,
        indentOnInput: true,
      }}
      className="overflow-hidden rounded-md [&_.cm-editor]:bg-transparent"
    />
  )
}
