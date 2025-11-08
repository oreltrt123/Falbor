"use client"

import { cn } from "@/lib/utils"

import { useEffect, useState } from "react"
import { Loader2, Globe, Code2, Search, Files } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileTree } from "@/components/workbench/file/file-tree"
import { Input } from "@/components/ui/input"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

interface CodePreviewProps {
  projectId: string
}

interface SearchResult {
  path: string
  line: number
  content: string
  matches: { start: number; end: number }[]
}

export function CodePreview({ projectId }: CodePreviewProps) {
  const [loading, setLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<
    Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  >([])
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null)
  const [sidebarView, setSidebarView] = useState<"files" | "search">("files")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const fetchFiles = async () => {
    try {
      const filesResponse = await fetch(`/api/projects/${projectId}/files`)
      const filesData = await filesResponse.json()
      setFiles(filesData.files || [])

      if (filesData.files && filesData.files.length > 0) {
        const latestFile = filesData.files[filesData.files.length - 1]

        // Only auto-switch if we're not already viewing a specific file the user selected
        setSelectedFile((prev) => {
          if (!prev) return latestFile

          // Find if current file still exists
          const stillExists = filesData.files.find((f: any) => f.path === prev.path)
          if (!stillExists) return latestFile

          // Update content if file was modified
          const updated = filesData.files.find((f: any) => f.path === prev.path)
          return updated || prev
        })
      }
    } catch (error) {
      console.error("[v0] Failed to fetch files:", error)
    }
  }

  useEffect(() => {
    const initPreview = async () => {
      try {
        const response = await fetch("/api/sandbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        })

        const data = await response.json()
        setPreviewUrl(data.previewUrl)

        await fetchFiles()
      } catch (error) {
        console.error("[v0] Failed to create preview:", error)
      } finally {
        setLoading(false)
      }
    }

    initPreview()

    const pollInterval = setInterval(() => {
      fetchFiles()
    }, 500)

    return () => clearInterval(pollInterval)
  }, [projectId])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(searchQuery)}`)
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
  }, [searchQuery])

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

  return (
    <div className="h-full flex flex-col border-l border-[#3b3b3f] rounded-l-2xl bg-[#212122]">
      <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                <img width={13} height={13} className="mr-1" src="/window.png" alt="" />
                {previewUrl}
              </a>
            )}
          </div>
          <TabsList className="w-[10%] justify-start">
            <TabsTrigger value="preview" className="gap-2">
              <Globe className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-2">
              <Code2 className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>
        </div>

        {/* PREVIEW TAB */}
        <TabsContent value="preview" className="flex-1 m-0">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Setting up preview...</span>
            </div>
          ) : previewUrl ? (
            <iframe src={previewUrl} className="w-full h-full border-0" title="Live Preview" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Failed to load preview
            </div>
          )}
        </TabsContent>

        {/* CODE TAB */}
        <TabsContent value="code" className="flex-1 m-0 flex overflow-hidden border-t border-[#3b3b3f] mt-[-5px]">
          <div className="w-64 border-r border-[#3b3b3f] overflow-y-auto bg-[#212122] flex flex-col">
            {/* Sidebar Tab Selector */}
            <div className="flex border-b border-[#3b3b3f] bg-[#1a1a1a]">
              <button
                onClick={() => setSidebarView("files")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors",
                  sidebarView === "files" ? "text-white bg-[#212122]" : "text-white/50 hover:text-white/75",
                )}
              >
                <Files className="w-4 h-4" />
                Files
              </button>
              <button
                onClick={() => setSidebarView("search")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors",
                  sidebarView === "search" ? "text-white bg-[#212122]" : "text-white/50 hover:text-white/75",
                )}
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>

            {/* Files View */}
            {sidebarView === "files" && (
              <>
                <div className="p-2 border-b bg-[#212122] border-[#3b3b3f]">
                  <p className="text-xs font-medium text-white">FILES ({files.length})</p>
                </div>
                <FileTree
                  files={files}
                  onFileSelect={(file) => {
                    console.log("[v0] User selected file:", file.path)
                    setSelectedFile(file)
                  }}
                  selectedPath={selectedFile?.path}
                  projectId={projectId}
                  onFilesChange={fetchFiles}
                />
              </>
            )}

            {/* Search View */}
            {sidebarView === "search" && (
              <div className="flex flex-col h-full">
                <div className="p-3 border-b border-[#3b3b3f]">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search files and code..."
                    className="w-full bg-[#1a1a1a] border-[#3b3b3f] text-white text-sm"
                  />
                </div>

                <div className="flex-1 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="w-5 h-5 animate-spin text-white/50" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="p-2">
                      <p className="text-xs text-white/50 mb-2">{searchResults.length} results</p>
                      {searchResults.map((result, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            const file = files.find((f) => f.path === result.path)
                            if (file) setSelectedFile(file)
                          }}
                          className="mb-3 p-2 hover:bg-[#3b3b3f] cursor-pointer rounded text-xs"
                        >
                          <div className="text-blue-400 font-mono mb-1">{result.path}</div>
                          <div className="text-white/60 mb-1">Line {result.line}</div>
                          <pre className="text-white/80 overflow-x-auto whitespace-pre-wrap break-words">
                            {highlightMatch(result.content, result.matches)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery ? (
                    <div className="p-4 text-center text-white/50 text-sm">No results found</div>
                  ) : (
                    <div className="p-4 text-center text-white/50 text-sm">Start typing to search</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Code pane */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                <div className="p-2 border-b border-[#3b3b3f] bg-[#212122]">
                  <p className="text-xs text-white font-mono">{selectedFile.path}</p>
                </div>

                <div className="flex-1 overflow-y-scroll chat-messages-scroll">
                  <SyntaxHighlighter
                    language={selectedFile.language}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      height: "100%",
                      minHeight: "100%",
                      display: "block",
                    }}
                    PreTag="div"
                    codeTagProps={{ style: { height: "100%" } }}
                  >
                    {selectedFile.content}
                  </SyntaxHighlighter>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {loading
                  ? "Loading files..."
                  : files.length === 0
                    ? "No files yet - Start coding!"
                    : "Select a file to view"}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
