// components/workbench/code-preview.tsx (Updated: Added injectBaseFiles() in initPreview; new refreshFilesAndPreview() function; pass to MainHeader)
"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState, useRef, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MainHeader } from "./main-header"
import { CodeTab } from "./code-tab"
import { PreviewTab } from "./preview-tab"
import { useAuth } from "@clerk/nextjs"
import { SettingsTab } from "./settings-tab"

interface CodePreviewProps {
  projectId: string
}

export function CodePreview({ projectId }: CodePreviewProps) {
  const [loading, setLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<
    Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  >([])
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [sidebarView, setSidebarView] = useState<"files" | "search">("files")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const previousScrollTop = useRef(0)
  const monacoRef = useRef<any>(null)
  const { getToken } = useAuth()

  const fetchFiles = async () => {
    try {
      const token = await getToken()
      const filesResponse = await fetch(`/api/projects/${projectId}/files`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!filesResponse.ok) {
        throw new Error(`HTTP error! status: ${filesResponse.status}`)
      }
      const filesData = await filesResponse.json()
      const newFiles = filesData.files || []

      if (scrollRef.current) {
        previousScrollTop.current = scrollRef.current.scrollTop
      }

      setFiles(newFiles)

      if (newFiles.length > 0) {
        const latestFile = newFiles[newFiles.length - 1]

        setSelectedFile((prev) => {
          if (!prev) return latestFile

          const stillExists = newFiles.find((f: any) => f.path === prev.path)
          if (!stillExists) return latestFile

          const updated = newFiles.find((f: any) => f.path === prev.path)
          return updated || prev
        })
      }
    } catch (error) {
      console.error("[v0] Failed to fetch files:", error)
    }
  }

  // NEW: Inject base files if missing (e.g., no package.json)
  const injectBaseFiles = async () => {
    try {
      const hasPackageJson = files.some(f => f.path === 'package.json')
      if (!hasPackageJson) {
        const token = await getToken()
        const response = await fetch(`/api/projects/${projectId}/inject-base`, {
          method: 'POST',
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ /* baseFiles array from above */ }), // Pass base files as payload
        })
        if (!response.ok) throw new Error('Failed to inject base files')
        console.log('[v0] Base files injected successfully')
        await fetchFiles() // Refresh after injection
      }
    } catch (error) {
      console.error("[v0] Failed to inject base files:", error)
    }
  }

  // NEW: Refresh function for button - refetch files + restart sandbox
  const refreshFilesAndPreview = async () => {
    setLoading(true)
    try {
      // Restart sandbox to re-bind port
      const token = await getToken()
      const response = await fetch("/api/sandbox", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, restart: true }), // Add restart flag if your API supports
      })
      if (response.ok) {
        const data = await response.json()
        setPreviewUrl(data.previewUrl)
      }
      // Re-inject base if needed, then fetch
      await injectBaseFiles()
      await fetchFiles()
    } catch (error) {
      console.error("[v0] Refresh failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedFile || editedContent === selectedFile.content) return

    try {
      const token = await getToken()
      await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(selectedFile.path)}`, {
        method: 'PUT',
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editedContent }),
      })
      await fetchFiles()
    } catch (error) {
      console.error("[v0] Failed to save file:", error)
    }
  }

  const handleDownload = async () => {
    // Import dynamically to avoid bundling if not needed
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    files.forEach((file) => {
      zip.file(file.path, file.content)
    })
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectId}.zip`
    a.click()
    URL.revokeObjectURL(url)
    setShowDownloadMenu(false)
  }

  useEffect(() => {
    const initPreview = async () => {
      try {
        const token = await getToken()
        const response = await fetch("/api/sandbox", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ projectId }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        setPreviewUrl(data.previewUrl)

        await fetchFiles()
        await injectBaseFiles() // NEW: Auto-insert after initial fetch
      } catch (error) {
        console.error("[v0] Failed to create preview:", error)
        await fetchFiles()
        await injectBaseFiles() // Fallback inject
      } finally {
        setLoading(false)
      }
    }

    initPreview()

    const pollInterval = setInterval(() => {
      fetchFiles()
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [projectId, getToken])

  useEffect(() => {
    if (selectedFile) {
      setEditedContent(selectedFile.content)
    }
  }, [selectedFile?.path, selectedFile?.content])

  useEffect(() => {
    if (scrollRef.current && previousScrollTop.current > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0, previousScrollTop.current)
      })
    }
  }, [files, selectedFile])

  // Fallback document listener for Ctrl+S (with capture to prevent browser default)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's' && isEditorFocused) {
        e.preventDefault()
        e.stopPropagation()
        handleSave()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isEditorFocused, handleSave])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const token = await getToken()
      const response = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error("[v0] Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch()
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [searchQuery, getToken])

  const highlightMatch = (text: string, matches: { start: number; end: number }[]) => {
    if (!matches || matches.length === 0) return text

    let lastIndex = 0
    const parts = []

    matches.forEach((match) => {
      parts.push(text.slice(lastIndex, match.start))
      parts.push(
        <mark key={match.start} className="bg-yellow-500/30">
          {text.slice(match.start, match.end)}
        </mark>,
      )
      lastIndex = match.end
    })

    parts.push(text.slice(lastIndex))
    return parts
  }

  const isDirty = selectedFile ? editedContent !== selectedFile.content : false

  const editorOptions = useMemo(() => ({
    wordWrap: 'on',
    fontSize: 13,
    fontFamily: 'Monaco, \'Cascadia Code\', monospace',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
  }), [])

return (
  <div className="h-full flex flex-col border border-[#d6d6d6] rounded-md bg-[#ffffff] relative overflow-hidden">
    <div className="absolute left-0 top-0 h-full w-1 bg-gray-500 opacity-0 hover:opacity-30 pointer-events-none rounded-l"></div>

      <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
        <MainHeader
          previewUrl={previewUrl}
          showDownloadMenu={showDownloadMenu}
          setShowDownloadMenu={setShowDownloadMenu}
          handleDownload={handleDownload}
          refreshFilesAndPreview={refreshFilesAndPreview}
          projectId={projectId}
        />
        <PreviewTab loading={loading} previewUrl={previewUrl} />
        <CodeTab
          sidebarView={sidebarView}
          setSidebarView={setSidebarView}
          files={files}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          editedContent={editedContent}
          setEditedContent={setEditedContent}
          isEditorFocused={isEditorFocused}
          setIsEditorFocused={setIsEditorFocused}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          highlightMatch={highlightMatch}
          isDirty={isDirty}
          handleSave={handleSave}
          projectId={projectId}
          fetchFiles={fetchFiles}
          scrollRef={scrollRef}
          monacoRef={monacoRef}
          editorOptions={editorOptions}
          loading={loading}
        />
        <TabsContent value="settings" className="flex-1 m-0 flex overflow-hidden rounded-bl-3xl border-t border-[#4444442d] mt-[-5px]">
          <SettingsTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
