// components/workbench/file-sidebar.tsx
import { FileTree } from "@/components/workbench/file/file-tree"

interface FileSidebarProps {
  files: Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  onFileSelect: (file: { path: string; content: string; language: string }) => void
  selectedPath: string | null
  projectId: string
  onFilesChange: () => void
  currentRoot?: string
}

export function FileSidebar({ files, onFileSelect, selectedPath, projectId, onFilesChange, currentRoot }: FileSidebarProps) {
  return (
    <>
      <FileTree
        files={files}
        onFileSelect={onFileSelect}
        selectedPath={selectedPath}
        projectId={projectId}
        onFilesChange={onFilesChange}
        currentRoot={currentRoot}
      />
    </>
  )
}