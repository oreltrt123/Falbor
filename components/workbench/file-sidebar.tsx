// components/workbench/file-sidebar.tsx
import { FileTree } from "@/components/workbench/file/file-tree"

interface FileSidebarProps {
  files: Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  onFileSelect: (file: { path: string; content: string; language: string }) => void
  selectedPath: string | null
  projectId: string
  onFilesChange: () => void
}

export function FileSidebar({ files, onFileSelect, selectedPath, projectId, onFilesChange }: FileSidebarProps) {
  return (
    <>
      {/* <div className="p-2 bg-[#1b1b1b]">
        <p className="text-xs font-medium text-white">FILES ({files.length})</p>
      </div> */}
      <FileTree
        files={files}
        onFileSelect={onFileSelect}
        selectedPath={selectedPath}
        projectId={projectId}
        onFilesChange={onFilesChange}
      />
    </>
  )
}