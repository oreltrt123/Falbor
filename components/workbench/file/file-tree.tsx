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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"

interface FileNode {
  name: string
  path: string // relative path
  fullPath: string // absolute path
  type: "file" | "folder"
  isLocked?: boolean
  additions?: number
  deletions?: number
  children?: FileNode[]
  content?: string
  language?: string
  isInput?: boolean
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
  currentRoot?: string
}

interface ContextMenuState {
  show: boolean
  x: number
  y: number
  node: FileNode | null
}

interface InsertInfo {
  targetPath: string
  inside: boolean
  type: "file" | "folder"
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
    relativePath: string
    fullPath: string
  }>,
  prefix: string,
): FileNode[] {
  const root: FileNode[] = []

  for (const file of files) {
    const parts = file.relativePath.split("/").filter(Boolean)
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const isFile = isLast && file.type !== "folder"

      let existingNode = currentLevel.find((node) => node.name === part)

      if (!existingNode) {
        const relativeFull = parts.slice(0, i + 1).join("/") || part
        const fullPath = prefix + relativeFull
        existingNode = {
          name: part,
          path: relativeFull,
          fullPath,
          type: isFile ? "file" : "folder",
          isLocked: isLast ? (file.isLocked || false) : false,
          additions: isLast ? file.additions : undefined,
          deletions: isLast ? file.deletions : undefined,
          children: isFile ? undefined : [],
          content: isLast ? file.content : undefined,
          language: isLast ? file.language : undefined,
        }
        currentLevel.push(existingNode)
      } else if (isLast) {
        existingNode.isLocked = file.isLocked || false
        existingNode.additions = file.additions
        existingNode.deletions = file.deletions
        existingNode.content = file.content
        existingNode.language = file.language
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

function buildWithInsert(nodes: FileNode[], insertInfo: InsertInfo): FileNode[] {
  const newNodes: FileNode[] = [];

  for (const node of nodes) {
    const isTarget = node.fullPath === insertInfo.targetPath;
    const dummy: FileNode = {
      name: "",
      path: "",
      fullPath: `${node.fullPath}_dummy`,
      type: insertInfo.type,
      isInput: true,
    };

    const recursedChildren = node.children ? buildWithInsert(node.children, insertInfo) : undefined;

    if (isTarget) {
      if (insertInfo.inside) {
        newNodes.push({
          ...node,
          children: [dummy, ...recursedChildren || []],
        });
      } else {
        newNodes.push({
          ...node,
          children: recursedChildren,
        });
        newNodes.push(dummy);
      }
    } else {
      newNodes.push({
        ...node,
        children: recursedChildren,
      });
    }
  }

  return newNodes;
}

function NewItemInput({
  type,
  level,
  inputValue,
  setInputValue,
  handleCreateNew,
  handleCancel,
}: {
  type: "file" | "folder"
  level: number
  inputValue: string
  setInputValue: (value: string) => void
  handleCreateNew: () => Promise<void>
  handleCancel: () => void
}) {
  const isFolder = type === "folder"
  const inputRef = useRef<HTMLInputElement>(null)
  const indent = level * 16

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      await handleCreateNew()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const onBlur = async () => {
    if (inputValue.trim()) {
      await handleCreateNew()
    } else {
      handleCancel()
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 pl-0 px-1 pr-2 py-[4px] cursor-text text-[13px] relative border border-blue-500",
      )}
      style={{ paddingLeft: `${indent + 8}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {isFolder ? (
        <>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Folder className="w-4 h-4 shrink-0 text-foreground/80" />
        </>
      ) : (
        <>
          <div className="w-4 shrink-0" />
          <File className="w-4 h-4 shrink-0 text-foreground/80" />
        </>
      )}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="focus:outline-none focus:ring-0 focus-visible:ring-0"
        placeholder={isFolder ? "Enter folder name..." : "Enter file name..."}
      />
    </div>
  )
}

function RenameInput({
  node,
  level,
  inputValue,
  setInputValue,
  handleRename,
  handleCancelRename,
}: {
  node: FileNode
  level: number
  inputValue: string
  setInputValue: (value: string) => void
  handleRename: () => Promise<void>
  handleCancelRename: () => void
}) {
  const isFolder = node.type === "folder"
  const [isOpen] = useState(false) // For rename, we don't toggle open, but keep as is
  const inputRef = useRef<HTMLInputElement>(null)
  const indent = level * 16

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      await handleRename()
    } else if (e.key === "Escape") {
      handleCancelRename()
    }
  }

  const onBlur = async () => {
    if (inputValue.trim()) {
      await handleRename()
    } else {
      handleCancelRename()
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 pl-0 px-1 pr-2 py-[4px] cursor-text text-[13px] relative border border-blue-500",
      )}
      style={{ paddingLeft: `${indent + 8}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {isFolder ? (
        <>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-foreground/80" />
          ) : (
            <Folder className="w-4 h-4 shrink-0 text-foreground/80" />
          )}
        </>
      ) : (
        <>
          <div className="w-4 shrink-0" />
          <File className="w-4 h-4 shrink-0 text-foreground/80" />
        </>
      )}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="focus:outline-none focus:ring-0 focus-visible:ring-0"
        placeholder={isFolder ? "Enter folder name..." : "Enter file name..."}
      />
    </div>
  )
}

function TreeNode({
  node,
  onFileSelect,
  selectedPath,
  level = 0,
  onContextMenu,
  projectId,
  insertInfo,
  renaming,
  inputValue,
  setInputValue,
  handleCreateNew,
  handleRename,
  handleCancel,
  handleCancelRename,
}: {
  node: FileNode
  onFileSelect: (file: { path: string; content: string; language: string }) => void
  selectedPath?: string | null
  level?: number
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  projectId: string
  insertInfo?: InsertInfo | null
  renaming: string | null
  inputValue: string
  setInputValue: (value: string) => void
  handleCreateNew: () => Promise<void>
  handleRename: () => Promise<void>
  handleCancel: () => void
  handleCancelRename: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const indent = level * 16

  useEffect(() => {
    if (insertInfo?.targetPath === node.fullPath && insertInfo.inside) {
      setIsOpen(true)
    }
  }, [insertInfo, node.fullPath])

  if (node.isInput) {
    return (
      <NewItemInput
        type={node.type}
        level={level}
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleCreateNew={handleCreateNew}
        handleCancel={handleCancel}
      />
    )
  }

  if (renaming === node.fullPath) {
    return (
      <RenameInput
        node={node}
        level={level}
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleRename={handleRename}
        handleCancelRename={handleCancelRename}
      />
    )
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (node.isLocked) return

    if (node.type === "folder") {
      setIsOpen(!isOpen)
    } else if (node.content && node.language) {
      onFileSelect({ path: node.fullPath, content: node.content, language: node.language })
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(e, node)
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 pl-0 px-1 pr-2 py-[4px] hover:bg-[#e4e4e4a8] cursor-pointer text-[13px] relative group",
          selectedPath === node.fullPath && " bg-[#e4e4e4a8]",
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
            {isOpen ? (
              <FolderOpen className="w-4 h-4 shrink-0 text-foreground/80" />
            ) : (
              <Folder className="w-4 h-4 shrink-0 text-foreground/80" />
            )}
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
              key={child.fullPath}
              node={child}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
              level={level + 1}
              onContextMenu={onContextMenu}
              projectId={projectId}
              insertInfo={insertInfo}
              renaming={renaming}
              inputValue={inputValue}
              setInputValue={setInputValue}
              handleCreateNew={handleCreateNew}
              handleRename={handleRename}
              handleCancel={handleCancel}
              handleCancelRename={handleCancelRename}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ files, onFileSelect, selectedPath, projectId, onFilesChange, currentRoot }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, x: 0, y: 0, node: null })
  const [newItem, setNewItem] = useState<{ targetPath: string; inside: boolean; type: "file" | "folder" } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")

  let prefix = ""
  if (currentRoot) {
    const rootItem = files.find((f) => f.path === currentRoot)
    if (rootItem?.type === "folder") {
      prefix = currentRoot + (currentRoot.endsWith("/") ? "" : "/")
    } else {
      const parts = currentRoot.split("/")
      prefix = parts.slice(0, -1).join("/") + (parts.length > 1 ? "/" : "")
    }
  }

  const filteredFiles = files
    .filter((f) => f.path.startsWith(prefix))
    .map((f) => ({
      ...f,
      relativePath: f.path.slice(prefix.length),
      fullPath: f.path,
    }))
    .filter((f) => f.relativePath)

  let tree = buildFileTree(filteredFiles, prefix)
  const insertInfo = newItem
  if (insertInfo) {
    tree = buildWithInsert(tree, insertInfo)
  }

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    setContextMenu({ show: true, x: e.clientX, y: e.clientY, node })
  }

  const getParentPath = (fullPath: string) => {
    return fullPath.split("/").slice(0, -1).join("/") || ""
  }

  const handleCreateNew = async () => {
    if (!newItem || !inputValue.trim()) {
      handleCancel()
      return
    }

    const basePath = newItem.inside ? `${newItem.targetPath}/` : `${getParentPath(newItem.targetPath)}/`
    const newPath = `${basePath}${inputValue.trim()}`

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: newPath,
          content: newItem.type === "folder" ? "" : "// New file\n",
          language: newItem.type === "folder" ? undefined : "typescript",
          type: newItem.type,
        }),
      })

      if (response.ok) {
        onFilesChange?.()
        handleCancel()
      } else {
        console.error("Failed to create:", await response.text())
      }
    } catch (error) {
      console.error("Failed to create file/folder:", error)
    }
  }

  const handleRename = async () => {
    if (!renaming || !inputValue.trim()) {
      handleCancelRename()
      return
    }

    const oldPath = renaming
    const parts = oldPath.split("/")
    parts[parts.length - 1] = inputValue.trim()
    const newPath = parts.join("/")

    if (oldPath === newPath) {
      handleCancelRename()
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath }),
      })

      if (response.ok) {
        onFilesChange?.()
        handleCancelRename()
      } else {
        console.error("Failed to rename:", await response.text())
      }
    } catch (error) {
      console.error("Failed to rename:", error)
    }
  }

  const handleCancel = () => {
    setNewItem(null)
    setInputValue("")
  }

  const handleCancelRename = () => {
    setRenaming(null)
    setInputValue("")
  }

  const handleDelete = async () => {
    if (!contextMenu.node) return

    try {
      const response = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent(contextMenu.node.fullPath)}`,
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
          path: contextMenu.node.fullPath,
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
      {tree.map((node) => (
        <TreeNode
          key={node.fullPath}
          node={node}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          onContextMenu={handleContextMenu}
          projectId={projectId}
          insertInfo={insertInfo}
          renaming={renaming}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleCreateNew={handleCreateNew}
          handleRename={handleRename}
          handleCancel={handleCancel}
          handleCancelRename={handleCancelRename}
        />
      ))}

      {/* Context Menu */}
      {contextMenu.node && (
        <DropdownMenu
          open={contextMenu.show}
          onOpenChange={(open) => {
            if (!open) {
              setContextMenu({ show: false, x: 0, y: 0, node: null })
            }
          }}
          modal={false}
        >
          <DropdownMenuContent
            className="fixed bg-background border border-[#e4e4e4f1] rounded-md p-0 
            z-50 min-w-[200px] text-sm"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          >
            <div className="p-2">
            <DropdownMenuItem
              onSelect={() => {
                setNewItem({ targetPath: contextMenu.node!.fullPath, inside: contextMenu.node!.type === "folder", type: "file" })
                setInputValue("")
                setContextMenu({ show: false, x: 0, y: 0, node: null })
              }}
            >
              <Plus className="w-4 h-4 mr-2 text-black" /> New File
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setNewItem({ targetPath: contextMenu.node!.fullPath, inside: contextMenu.node!.type === "folder", type: "folder" })
                setInputValue("")
                setContextMenu({ show: false, x: 0, y: 0, node: null })
              }}
            >
              <Folder className="w-4 h-4 mr-2 text-black" /> New Folder
            </DropdownMenuItem>
            </div>
            <hr className="text-[#e4e4e4f1]"/>
            <div className="p-2">
            <DropdownMenuItem
              onSelect={() => {
                setInputValue(contextMenu.node!.name)
                setRenaming(contextMenu.node!.fullPath)
                setContextMenu({ show: false, x: 0, y: 0, node: null })
              }}
            >
              <Edit className="w-4 h-4 mr-2 text-black" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleToggleLock}
            >
              {contextMenu.node.isLocked ? <Unlock className="w-4 h-4 mr-2 text-black" /> : <Lock className="w-4 h-4 mr-2 text-black" />}
              {contextMenu.node.isLocked ? "Unlock" : "Lock"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleDelete}
              className="text-destructive/90 focus:text-destructive"
            >
              <Trash className="w-4 h-4 mr-2 text-destructive/60" /> Delete
            </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}