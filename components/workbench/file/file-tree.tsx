"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Plus,
  Edit,
  Trash,
  Lock,
  Unlock,
} from "lucide-react"
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

// Sort children: folders first, then files, both alphabetically
function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.type === "folder" && b.type === "file") return -1
    if (a.type === "file" && b.type === "folder") return 1
    return a.name.localeCompare(b.name)
  })
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
    const parts = file.path.split("/").filter(Boolean) // Prevent empty parts
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const isFile = isLast && file.type !== "folder"

      let existingNode = currentLevel.find((node) => node.name === part)

      if (!existingNode) {
        const fullPath = parts.slice(0, i + 1).join("/")
        existingNode = {
          name: part,
          path: fullPath || part, // Handle root-level files
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

  // Recursively sort all levels
  function recursivelySort(node: FileNode): void {
    if (node.children) {
      node.children = sortNodes(node.children)
      node.children.forEach(recursivelySort)
    }
  }

  root.forEach(recursivelySort)
  return sortNodes(root)
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
  const [isOpen, setIsOpen] = useState(level < 2) // Auto-expand top 2 levels

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

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

  const indent = level * 16 // Increased indent for better hierarchy

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 pl-0 px-1 pr-2 py-[4px] hover:bg-[#e4e4e4a8] cursor-pointer text-[13px] relative group",
          selectedPath === node.path && " bg-[#e4e4e4a8]",
          node.isLocked && "opacity-50",
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.type === "folder" ? (
          <>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            {/* {isOpen ? (
              <FolderOpen className="w-4 h-4 shrink-0 text-black/80" />
            ) : (
              <Folder className="w-4 h-4 shrink-0 text-black/80" />
            )} */}
          </>
        ) : (
          <>
            <div className="w-4 shrink-0" />
            <File className="w-4 h-4 shrink-0 text-foreground/80" />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>

        {node.type === "file" && ((node.additions || 0) > 0 || (node.deletions || 0) > 0) && (
          <div className="flex items-center gap-1 text-[10px] opacity-80">
            {(node.additions || 0) > 0 && <span className="text-green-600">+{node.additions}</span>}
            {(node.deletions || 0) > 0 && <span className="text-red-600">-{node.deletions}</span>}
          </div>
        )}

        {node.isLocked && <Lock className="w-3 h-3 text-red-500 ml-1 shrink-0" />}
      </div>

      {node.type === "folder" && isOpen && node.children && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={`${child.path}-${index}`}
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

    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [contextMenu.show])

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    setContextMenu({ show: true, x: e.clientX, y: e.clientY, node })
  }

  const getParentPath = (node: FileNode) => {
    return node.type === "folder" ? node.path : node.path.split("/").slice(0, -1).join("/") || ""
  }

  const handleCreateFile = async () => {
    if (!showInput || !inputValue.trim()) return

    const basePath = showInput.parentPath ? `${showInput.parentPath}/` : ""
    const newPath = `${basePath}${inputValue.trim()}`

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: newPath,
          content: showInput.type === "folder" ? "" : "// New file\n",
          language: showInput.type === "folder" ? undefined : "typescript",
          type: showInput.type,
        }),
      })

      if (response.ok) onFilesChange?.()
    } catch (error) {
      console.error("Failed to create file/folder:", error)
    }

    setShowInput(null)
    setInputValue("")
  }

  const handleRename = async () => {
    if (!showInput || !inputValue.trim() || !contextMenu.node) return

    const oldPath = contextMenu.node.path
    const parentPath = oldPath.split("/").slice(0, -1).join("/")
    const newPath = parentPath ? `${parentPath}/${inputValue.trim()}` : inputValue.trim()

    if (oldPath === newPath) {
      setShowInput(null)
      setInputValue("")
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath }),
      })

      if (response.ok) onFilesChange?.()
    } catch (error) {
      console.error("Failed to rename:", error)
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
        { method: "DELETE" },
      )
      if (response.ok) onFilesChange?.()
    } catch (error) {
      console.error("Failed to delete:", error)
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
      if (response.ok) onFilesChange?.()
    } catch (error) {
      console.error("Failed to toggle lock:", error)
    }

    setContextMenu({ show: false, x: 0, y: 0, node: null })
  }

  return (
    <div className="text-sm select-none">
      {tree.map((node, index) => (
        <TreeNode
          key={node.path}
          node={node}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          onContextMenu={handleContextMenu}
          projectId={projectId}
        />
      ))}

      {/* Context Menu */}
      {contextMenu.show && contextMenu.node && (
        <div
          ref={contextMenuRef}
          className="fixed bg-background border rounded-md shadow-lg py-1 z-50 min-w-[200px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setShowInput({ type: "file", parentPath: getParentPath(contextMenu.node!) })
              setContextMenu({ show: false, x: 0, y: 0, node: null })
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent"
          >
            <Plus className="w-4 h-4" /> New File
          </button>
          <button
            onClick={() => {
              setShowInput({ type: "folder", parentPath: getParentPath(contextMenu.node!) })
              setContextMenu({ show: false, x: 0, y: 0, node: null })
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent"
          >
            <Folder className="w-4 h-4" /> New Folder
          </button>
          <button
            onClick={() => {
              setInputValue(contextMenu.node!.name)
              setShowInput({ type: "rename", parentPath: contextMenu.node!.path })
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent"
          >
            <Edit className="w-4 h-4" /> Rename
          </button>
          <button
            onClick={handleToggleLock}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent"
          >
            {contextMenu.node.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {contextMenu.node.isLocked ? "Unlock" : "Lock"}
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-destructive hover:bg-accent"
          >
            <Trash className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      {/* Create/Rename Modal */}
      {showInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-5 w-96 shadow-xl">
            <h3 className="text-lg font-medium mb-4">
              {showInput.type === "rename"
                ? "Rename"
                : `Create New ${showInput.type === "file" ? "File" : "Folder"}`}
            </h3>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={showInput.type === "file" ? "e.g. component.tsx" : "folder-name"}
              className="mb-4"
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
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowInput(null)
                  setInputValue("")
                }}
                className="px-4 py-2 text-sm hover:bg-accent rounded"
              >
                Cancel
              </button>
              <button
                onClick={showInput.type === "rename" ? handleRename : handleCreateFile}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded"
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