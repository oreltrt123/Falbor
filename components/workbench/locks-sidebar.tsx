// components/workbench/locks-sidebar.tsx
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Unlock } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

interface LocksSidebarProps {
  files: Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  projectId: string
  onFilesChange: () => void
}

export function LocksSidebar({ files, projectId, onFilesChange }: LocksSidebarProps) {
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<"all" | "file" | "folder">("all")
  const [selected, setSelected] = React.useState<string[]>([])

  const lockedItems = files.filter(f => f.isLocked)

  const filteredItems = lockedItems.filter(item => {
    const matchesSearch = item.path.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === "all" || (item.type || "file") === filter
    return matchesSearch && matchesFilter
  })

  const toggleSelect = (path: string) => {
    setSelected(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const toggleSelectAll = () => {
    if (selected.length === filteredItems.length) {
      setSelected([])
    } else {
      setSelected(filteredItems.map(item => item.path))
    }
  }

  const handleUnlock = async (path: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          isLocked: false,
        }),
      })
      if (response.ok) {
        onFilesChange()
        setSelected(prev => prev.filter(p => p !== path))
      }
    } catch (error) {
      console.error("Failed to unlock:", error)
    }
  }

  const handleUnlockSelected = async () => {
    for (const path of selected) {
      await handleUnlock(path)
    }
    setSelected([])
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-2 flex items-center gap-2">
        <Input
          placeholder="Search locked items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 h-8 text-sm"
        />
        <Select value={filter} onValueChange={(v: "all" | "file" | "folder") => setFilter(v)}>
          <SelectTrigger className="w-[100px] h-8 text-sm">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="file">Files</SelectItem>
            <SelectItem value="folder">Folders</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="px-2 pb-1 flex items-center gap-2">
        <Checkbox
          checked={selected.length === filteredItems.length && filteredItems.length > 0}
          onCheckedChange={toggleSelectAll}
          className="h-4 w-4"
        />
        <span className="text-xs text-muted-foreground">Select All</span>
        <Button
          variant="outline"
          size="sm"
          disabled={selected.length === 0}
          onClick={handleUnlockSelected}
          className="ml-auto h-6 text-xs"
        >
          <Unlock className="w-3 h-3 mr-1" />
          Unlock Selected
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredItems.map(item => (
          <div
            key={item.path}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 text-sm"
          >
            <Checkbox
              checked={selected.includes(item.path)}
              onCheckedChange={() => toggleSelect(item.path)}
              className="h-4 w-4"
            />
            <div className="flex-1 truncate">{item.path}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleUnlock(item.path)}
              className="h-6 px-2 text-xs"
            >
              <Unlock className="w-3 h-3 mr-1" />
              Unlock
            </Button>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-4">
            No locked items found
          </div>
        )}
      </div>
    </div>
  )
}