// components/workbench/code-tab.tsx
import { TabsContent } from "@/components/ui/tabs"
import { FileTree } from "@/components/workbench/file/file-tree" // Already separate
import { SidebarTabs } from "./sidebar-tabs"
import { FileSidebar } from "./file-sidebar"
import { SearchSidebar } from "./search-sidebar"
import { EditorPane } from "./editor-pane"
import { Input } from "@/components/ui/input" // If needed elsewhere

interface CodeTabProps {
  sidebarView: "files" | "search"
  setSidebarView: (view: "files" | "search") => void
  files: Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  selectedFile: { path: string; content: string; language: string } | null
  setSelectedFile: (file: { path: string; content: string; language: string } | null) => void
  editedContent: string
  setEditedContent: (content: string) => void
  isEditorFocused: boolean
  setIsEditorFocused: (focused: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: any[]
  isSearching: boolean
  highlightMatch: (text: string, matches: { start: number; end: number }[]) => any
  isDirty: boolean
  handleSave: () => void
  projectId: string
  fetchFiles: () => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  monacoRef: React.RefObject<any>
  editorOptions: any
  loading?: boolean // For no files message
}

export function CodeTab({
  sidebarView,
  setSidebarView,
  files,
  selectedFile,
  setSelectedFile,
  editedContent,
  setEditedContent,
  isEditorFocused,
  setIsEditorFocused,
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  highlightMatch,
  isDirty,
  handleSave,
  projectId,
  fetchFiles,
  scrollRef,
  monacoRef,
  editorOptions,
  loading,
}: CodeTabProps) {
  const handleFileSelect = (file: any) => {
    console.log("[v0] User selected file:", file.path)
    setSelectedFile(file)
  }

  const handleSearchResultClick = (path: string) => {
    const file = files.find((f) => f.path === path)
    if (file) setSelectedFile(file)
  }

  return (
    <TabsContent value="code" className="flex-1 m-0 flex overflow-hidden rounded-bl-3xl border-t border-[#4444442d] mt-[-5px]">
      <div className="w-64 overflow-y-hidden bg-[#1b1b1b] border border-[#4444442d] border-b-0 border-l-0 border-t-0 flex flex-col">
        <SidebarTabs sidebarView={sidebarView} setSidebarView={setSidebarView} />
        {sidebarView === "files" && (
          <FileSidebar
            files={files}
            onFileSelect={handleFileSelect}
            selectedPath={selectedFile?.path ?? null}
            projectId={projectId}
            onFilesChange={fetchFiles}
          />
        )}
        {sidebarView === "search" && (
          <SearchSidebar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            highlightMatch={highlightMatch}
            onResultClick={handleSearchResultClick}
            files={files}
          />
        )}
      </div>
      <EditorPane
        selectedFile={selectedFile}
        editedContent={editedContent}
        setEditedContent={setEditedContent}
        isEditorFocused={isEditorFocused}
        setIsEditorFocused={setIsEditorFocused}
        isDirty={isDirty}
        handleSave={handleSave}
        scrollRef={scrollRef}
        monacoRef={monacoRef}
        editorOptions={editorOptions}
      />
    </TabsContent>
  )
}