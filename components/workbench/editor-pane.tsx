// components/workbench/editor-pane.tsx
import { cn } from "@/lib/utils"
import { Save } from "lucide-react"
import { Editor } from '@monaco-editor/react'

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
  const extension = filePath.split(".").pop()?.toLowerCase()
  switch (extension) {
    case "ts":
    case "tsx":
      return "typescript"
    case "js":
    case "jsx":
      return "javascript"
    case "py":
      return "python"
    case "html":
      return "html"
    case "css":
      return "css"
    case "json":
      return "json"
    case "md":
      return "markdown"
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
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {selectedFile ? (
        <>
          <div className="p-1.5 bg-[#ffffff] border-b border-[#4444442d] flex items-center justify-between">
            <p className="text-xs text-black font-mono">{selectedFile.path}</p>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(
                "flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                isDirty && "text-green-500 hover:text-green-400"
              )}
              title={isDirty ? "Save changes" : "No changes to save"}
            >
              <Save className="w-3 h-3" />
              {isDirty && <span className="text-xs">Save</span>}
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-hidden">
            <Editor
              onMount={(editor, monaco) => {
                if (!editor) return;
                monacoRef.current = editor
                editor.onDidFocusEditorWidget(() => setIsEditorFocused(true))
                editor.onDidBlurEditorWidget(() => setIsEditorFocused(false))
              }}
              height="100%"
              defaultLanguage={getLanguage(selectedFile.path)}
              value={editedContent}
              onChange={(value) => setEditedContent(value || '')}
              theme="vs-light"
              options={editorOptions}
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