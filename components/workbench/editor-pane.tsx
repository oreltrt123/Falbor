"use client"
import { cn } from "@/lib/utils"
import { Save } from "lucide-react"
import { Editor } from "@monaco-editor/react"
import * as React from "react"
interface EditorPaneProps {
  selectedFile: { path: string; content: string } | null
  editedContent: string
  setEditedContent: (content: string) => void
  isEditorFocused: boolean
  setIsEditorFocused: (focused: boolean) => void
  isDirty: boolean
  handleSave: () => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  monacoRef: React.RefObject<any>
  editorOptions: any
}
const getLanguage = (filePath: string): string => {
  if (!filePath) return "plaintext"
  const ext = filePath.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript"
    case "js":
    case "jsx":
      return "javascript"
    case "json":
      return "json"
    case "css":
      return "css"
    case "html":
      return "html"
    case "md":
      return "markdown"
    case "py":
      return "python"
    case "yml":
    case "yaml":
      return "yaml"
    default:
      return "plaintext"
  }
}
export function EditorPane({
  selectedFile,
  editedContent,
  setEditedContent,
  isEditorFocused,
  setIsEditorFocused,
  isDirty,
  handleSave,
  scrollRef,
  monacoRef,
  editorOptions,
}: EditorPaneProps) {
  const language = React.useMemo(
    () => (selectedFile ? getLanguage(selectedFile.path) : "plaintext"),
    [selectedFile?.path]
  )
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {selectedFile ? (
        <>
          {/* Header */}
          <div className="px-3 py-1 bg-white border-b border-black/10 flex items-center justify-between">
            <p className="text-xs text-black font-mono truncate">
              {selectedFile.path}
            </p>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(
                "flex items-center gap-1 text-xs p-1 rounded",
                isDirty ? "text-green-500 opacity-100" : "opacity-0",
              )}
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          </div>
          {/* Editor */}
          <div ref={scrollRef} className="flex-1 overflow-hidden">
            <Editor
              key={selectedFile.path} // ⬅️ forces full reload = no partial coloring
              height="100%"
              language={language}
              value={editedContent}
              theme="vs" // ✅ REAL VS Code light theme
              onMount={(editor, monaco) => {
                monacoRef.current = editor
                // Disable validation to remove red error squiggles
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                  noSemanticValidation: true,
                  noSyntaxValidation: true,
                })
                // Force semantic highlighting (THIS IS IMPORTANT)
                monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                  target: monaco.languages.typescript.ScriptTarget.ESNext,
                  allowNonTsExtensions: true,
                  moduleResolution:
                    monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                })
                editor.onDidFocusEditorWidget(() =>
                  setIsEditorFocused(true)
                )
                editor.onDidBlurEditorWidget(() =>
                  setIsEditorFocused(false)
                )
                // Force full tokenization immediately
                editor.updateOptions({
                  renderValidationDecorations: "on",
                })
              }}
              onChange={(value) => setEditedContent(value || "")}
              options={{
                ...editorOptions,
                readOnly: false,
                automaticLayout: true,
                fontLigatures: true,
                semanticHighlighting: true, // 🔥 KEY
                smoothScrolling: true,
                cursorBlinking: "smooth",
                minimap: { enabled: false },
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
              }}
            />
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Select a file to view
        </div>
      )}
    </div>
  )
}