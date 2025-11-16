"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Edit, Trash, Lock, Unlock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface FileNode {
  name: string
  path: string
  type: "file" | "folder"
  isLocked?: boolean
  additions?: number
  deletions?: number
  children?: FileNode[]
  content?: string
  language?: string
}

interface FileTreeProps {
  files: Array<{
    path: string
    content: string
    language: string
    type?: string
    isLocked?: boolean
    additions?: number
    deletions?: number
  }>
  onFileSelect: (file: { path: string; content: string; language: string }) => void
  selectedPath?: string | null
  projectId: string
  onFilesChange?: () => void
}

interface ContextMenuState {
  show: boolean
  x: number
  y: number
  node: FileNode | null
}

function buildFileTree(
  files: Array<{
    path: string
    content: string
    language: string
    type?: string
    isLocked?: boolean
    additions?: number
    deletions?: number
  }>,
): FileNode[] {
  const root: FileNode[] = []

  for (const file of files) {
    const parts = file.path.split("/")
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1 && file.type !== "folder"

      let existingNode = currentLevel.find((node) => node.name === part)

      if (!existingNode) {
        existingNode = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "folder",
          isLocked: file.isLocked || false,
          additions: isFile ? file.additions : undefined,
          deletions: isFile ? file.deletions : undefined,
          children: isFile ? undefined : [],
          content: isFile ? file.content : undefined,
          language: isFile ? file.language : undefined,
        }
        currentLevel.push(existingNode)
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children
      }
    }
  }

  return root
}

function TreeNode({
  node,
  onFileSelect,
  selectedPath,
  level = 0,
  onContextMenu,
  projectId,
}: {
  node: FileNode
  onFileSelect: (file: { path: string; content: string; language: string }) => void
  selectedPath?: string | null
  level?: number
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  projectId: string
}) {
  const [isOpen, setIsOpen] = useState(level < 2)

  const handleClick = () => {
    if (node.isLocked) return

    if (node.type === "folder") {
      setIsOpen(!isOpen)
    } else if (node.content && node.language) {
      onFileSelect({ path: node.path, content: node.content, language: node.language })
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(e, node)
  }

  const indent = `${level * 12 + 8}px`

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 pl-0 px-1 pr-2 py-[3px] mb-1 hover:bg-[#e4e4e4] cursor-pointer text-[13px] relative group rounded-sm",
          selectedPath === node.path && "font-bold hover:bg-white",
          node.isLocked && "opacity-50",
        )}
        style={{ 
          marginLeft: indent,
          width: `calc(100% - ${indent})`
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.type === "folder" ? (
          <>
            {isOpen ? (
              <>
                <ChevronDown className="w-4 h-4 text-black" />
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4 text-black" />
              </>
            )}
          </>
        ) : (
          <>
            <div className="w-4" />
            <File className="w-4 h-4 text-black" />
          </>
        )}
        <span className="truncate text-black flex-1">{node.name}</span>
        {node.type === "file" && ((node.additions || 0) > 0 || (node.deletions || 0) > 0) && (
          <div className="flex items-center gap-1 text-[10px] ml-auto">
            {(node.additions || 0) > 0 && <span className="text-green-500">+{node.additions}</span>}
            {(node.deletions || 0) > 0 && <span className="text-red-500">-{node.deletions}</span>}
          </div>
        )}
        {node.isLocked && <Lock className="w-3 h-3 ml-1 text-red-400" />}
      </div>

      {node.type === "folder" && isOpen && !node.isLocked && node.children && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={index}
              node={child}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
              level={level + 1}
              onContextMenu={onContextMenu}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ files, onFileSelect, selectedPath, projectId, onFilesChange }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, x: 0, y: 0, node: null })
  const [showInput, setShowInput] = useState<{ type: "file" | "folder" | "rename"; parentPath: string } | null>(null)
  const [inputValue, setInputValue] = useState("")
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const tree = buildFileTree(files)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ show: false, x: 0, y: 0, node: null })
      }
    }

    if (contextMenu.show) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [contextMenu.show])

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    setContextMenu({ show: true, x: e.clientX, y: e.clientY, node })
  }

  const handleCreateFile = async () => {
    if (!showInput || !inputValue.trim()) return

    const basePath = showInput.parentPath ? `${showInput.parentPath}/` : ""
    const newPath = `${basePath}${inputValue}`

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: newPath,
          content: showInput.type === "folder" ? "" : "// New file",
          language: showInput.type === "folder" ? "folder" : "typescript",
          type: showInput.type,
        }),
      })

      if (response.ok) {
        onFilesChange?.()
      }
    } catch (error) {
      console.error("[v0] Failed to create file:", error)
    }

    setShowInput(null)
    setInputValue("")
  }

  const handleRename = async () => {
    if (!showInput || !inputValue.trim() || !contextMenu.node) return

    const oldPath = contextMenu.node.path
    const parentPath = oldPath.split("/").slice(0, -1).join("/")
    const newPath = parentPath ? `${parentPath}/${inputValue}` : inputValue

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPath,
          newPath,
        }),
      })

      if (response.ok) {
        onFilesChange?.()
      }
    } catch (error) {
      console.error("[v0] Failed to rename:", error)
    }

    setShowInput(null)
    setInputValue("")
    setContextMenu({ show: false, x: 0, y: 0, node: null })
  }

  const handleDelete = async () => {
    if (!contextMenu.node) return

    try {
      const response = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent(contextMenu.node.path)}`,
        {
          method: "DELETE",
        },
      )

      if (response.ok) {
        onFilesChange?.()
      }
    } catch (error) {
      console.error("[v0] Failed to delete:", error)
    }

    setContextMenu({ show: false, x: 0, y: 0, node: null })
  }

  const handleToggleLock = async () => {
    if (!contextMenu.node) return

    try {
      const response = await fetch(`/api/projects/${projectId}/files/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: contextMenu.node.path,
          isLocked: !contextMenu.node.isLocked,
        }),
      })

      if (response.ok) {
        onFilesChange?.()
      }
    } catch (error) {
      console.error("[v0] Failed to toggle lock:", error)
    }

    setContextMenu({ show: false, x: 0, y: 0, node: null })
  }

  return (
    <div className="text-sm relative p-2">
      {tree.map((node, index) => (
        <TreeNode
          key={index}
          node={node}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          onContextMenu={handleContextMenu}
          projectId={projectId}
        />
      ))}

      {contextMenu.show && contextMenu.node && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[#ffffff] border border-[#e0e0e0c9] rounded-md py-1 z-50 min-w-[180px] p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setShowInput({
                type: "file",
                parentPath:
                  contextMenu.node?.type === "folder"
                    ? contextMenu.node.path
                    : contextMenu.node?.path.split("/").slice(0, -1).join("/") || "",
              })
              setContextMenu({ show: false, x: 0, y: 0, node: null })
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]`}
          >
            <Plus className="w-4 h-4" />
            New File
          </button>
          <button
            onClick={() => {
              setShowInput({
                type: "folder",
                parentPath:
                  contextMenu.node?.type === "folder"
                    ? contextMenu.node.path
                    : contextMenu.node?.path.split("/").slice(0, -1).join("/") || "",
              })
              setContextMenu({ show: false, x: 0, y: 0, node: null })
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]`}
          >
            <Folder className="w-4 h-4" />
            New Folder
          </button>
          <button
            onClick={() => {
              setInputValue(contextMenu.node?.name || "")
              setShowInput({ type: "rename", parentPath: contextMenu.node?.path || "" })
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]`}
          >
            <Edit className="w-4 h-4" />
            Rename
          </button>
          <button
            onClick={handleToggleLock}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]`}
          >
            {contextMenu.node.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {contextMenu.node.isLocked ? "Unlock" : "Lock"}
          </button>
          <button
            onClick={handleDelete}
            className={`w-full flex text-red-700 items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]`}
          >
            <Trash className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {showInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2a2a2a] border border-[#3b3b3f] rounded-lg p-4 w-96">
            <h3 className="text-white font-medium mb-3">
              {showInput.type === "rename" ? "Rename" : `Create New ${showInput.type === "file" ? "File" : "Folder"}`}
            </h3>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={showInput.type === "file" ? "filename.tsx" : "folder-name"}
              className="mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  showInput.type === "rename" ? handleRename() : handleCreateFile()
                } else if (e.key === "Escape") {
                  setShowInput(null)
                  setInputValue("")
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowInput(null)
                  setInputValue("")
                }}
                className="px-3 py-1.5 text-sm text-white hover:bg-[#3b3b3f] rounded"
              >
                Cancel
              </button>
              <button
                onClick={showInput.type === "rename" ? handleRename : handleCreateFile}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
              >
                {showInput.type === "rename" ? "Rename" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}