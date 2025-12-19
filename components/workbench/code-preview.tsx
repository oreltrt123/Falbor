// File: components/CodePreview.tsx
// No changes needed; this file appears to be functioning as intended based on the provided error context.
"use client"
import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { TerminalIcon, Plus, Loader2, X } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { MainHeader } from "./main-header"
import { CodeTab } from "./code-tab"
import { SettingsTab } from "./settings-tab"
import { useAuth } from "@clerk/nextjs"
import {
  SandpackProvider,
  SandpackFileExplorer,
  SandpackCodeEditor,
  SandpackPreview,
} from "@codesandbox/sandpack-react"
import { DatabasePanel } from "./database-panel"

interface CodePreviewProps {
  projectId: string
  isCodeGenerating?: boolean
  onError?: (error: { message: string; file?: string; line?: string }) => void
  isOpen?: boolean
  onClose?: () => void
  currentVersion?: string
  filesOverride?: Array<{ path: string; content: string; language: string }>
  isGitHubImport?: boolean // Added flag to detect GitHub imports
}

interface TerminalTab {
  id: number
  title: string
}

const AUTO_GENERATED_FILES = [
  "public/index.html",
  "src/App.tsx",
  "src/index.css",
  "src/main.tsx",
  "src/App.css",
  "README.md",
  "index.html",
  "index.tsx",
  "manifest.json",
  "postcss.config.js",
  "postcss.config.ts",
  "styles.css",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "vite.config.js",
  "vite.config.ts",
  "package.json",
  ".gitignore",
  "package-lock.json",
  "yarn.lock",
]

function shouldHideFile(filePath: string, isGitHubImport: boolean): boolean {
  if (!isGitHubImport) return false // Show all files for AI-generated projects

  // Normalize path (remove leading slash/backslash)
  const normalizedPath = filePath.replace(/^[/\\]+/, "")

  return AUTO_GENERATED_FILES.some((autoGenFile) => {
    const normalizedAutoGen = autoGenFile.replace(/^[/\\]+/, "")
    return normalizedPath === normalizedAutoGen || normalizedPath.endsWith(`/${normalizedAutoGen}`)
  })
}

function SandpackPreviewClient() {
  const previewRef = useRef<any>(null)
  return <SandpackPreview ref={previewRef} showNavigator={true} style={{ height: "100%" }} />
}

export function CodePreview({
  projectId,
  isCodeGenerating,
  onError,
  isOpen = true,
  onClose,
  currentVersion,
  filesOverride,
  isGitHubImport = false, // Default to false for AI-generated projects
}: CodePreviewProps) {
  const [files, setFiles] = useState<
    Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  >([])
  const [projectType, setProjectType] = useState<"python" | "react" | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [sidebarView, setSidebarView] = useState<"files" | "search">("files")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [pyodideReady, setPyodideReady] = useState(false)
  const [filesLoaded, setFilesLoaded] = useState(false)
  const [terminalError, setTerminalError] = useState<string | null>(null)

  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([{ id: 1, title: "Python REPL" }])
  const [activeTerminalTab, setActiveTerminalTab] = useState(1)

  const terminals = useRef<Map<number, any>>(new Map())
  const fitAddons = useRef<Map<number, any>>(new Map())
  const terminalRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  const monacoRef = useRef<any>(null)
  const pyodideRef = useRef<any>(null)
  const replBuffers = useRef<Map<number, { buffer: string; prompt: string }>>(new Map())
  const { getToken } = useAuth()

  const effectiveFiles = useMemo(() => {
    const sourceFiles = filesOverride || files

    if (!isGitHubImport) return sourceFiles // Show all files for AI projects

    // Filter out auto-generated files for GitHub imports
    const filtered = sourceFiles.filter((file) => !shouldHideFile(file.path, isGitHubImport))

    console.log("[v0] GitHub Import detected: filtering auto-generated files")
    console.log("[v0] Original files:", sourceFiles.length, "Filtered files:", filtered.length)

    return filtered
  }, [filesOverride, files, isGitHubImport])

  const sandpackFiles = useMemo(() => {
    if (projectType !== "react" || effectiveFiles.length === 0) return {}
    return effectiveFiles.reduce((acc: Record<string, string>, file) => {
      const key = `/${file.path.startsWith("/") ? file.path.slice(1) : file.path}`
      acc[key] = file.content
      return acc
    }, {})
  }, [effectiveFiles, projectType])

  const template = useMemo(() => {
    if (projectType !== "react") return "react"
    const hasTs = effectiveFiles.some((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"))
    return hasTs ? "react-ts" : "react"
  }, [effectiveFiles, projectType])

  const defaultDependencies = useMemo(
    () => ({
      react: "^18.2.0",
      "react-dom": "^18.2.0",
    }),
    [],
  )

  const filesKey = useMemo(() => effectiveFiles.map((f) => `${f.path}:${f.content.length}`).join("|"), [effectiveFiles])

  useEffect(() => {
    if (effectiveFiles.length === 0) {
      setProjectType(null)
      return
    }
    const hasPy = effectiveFiles.some((f) => f.language === "python" || f.path.endsWith(".py"))
    const hasJsTs = effectiveFiles.some(
      (f) =>
        f.language === "javascript" ||
        f.language === "typescript" ||
        f.path.match(/\.j(sx?)$/) ||
        f.path.match(/\.ts(x?)$/),
    )
    if (hasPy && !hasJsTs) {
      setProjectType("python")
    } else if (hasJsTs && !hasPy) {
      setProjectType("react")
    } else if (hasPy && hasJsTs) {
      setProjectType("python")
    } else {
      setProjectType(null)
    }
  }, [filesKey])

  const highlightMatch = useCallback((text: string, matches: { start: number; end: number }[]) => {
    let result = text
    matches.forEach(({ start, end }) => {
      const before = result.substring(0, start)
      const match = result.substring(start, end)
      const after = result.substring(end)
      result = `${before}<mark>${match}</mark>${after}`
    })
    return <div dangerouslySetInnerHTML={{ __html: result }} />
  }, [])

  useEffect(() => {
    if (projectType !== "python") {
      setPyodideReady(false)
      pyodideRef.current = null
      return
    }

    let scriptLoaded = false
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js"
    script.onload = async () => {
      scriptLoaded = true
      try {
        const pyodide = await (window as any).loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/",
          stdin: () => "",
        })
        pyodideRef.current = pyodide
        setPyodideReady(true)
        console.log("[Python Preview] Pyodide loaded successfully")
        loadFilesIntoPyodide()
      } catch (error) {
        console.error("[Python Preview] Failed to load Pyodide:", error)
      }
    }
    document.head.appendChild(script)

    return () => {
      if (scriptLoaded && document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [projectType])

  const loadFilesIntoPyodide = useCallback(async () => {
    if (projectType !== "python" || !pyodideRef.current || effectiveFiles.length === 0) return

    try {
      console.log("[Python Preview] Loading", effectiveFiles.length, "files to Pyodide FS")
      for (const file of effectiveFiles) {
        if (!file.path || typeof file.content !== "string") continue
        const fullPath = "/" + file.path
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"))
        if (dirPath && dirPath !== "/") {
          try {
            pyodideRef.current.FS.mkdirTree(dirPath)
          } catch (e) {
            // Ignore if exists
          }
        }
        pyodideRef.current.FS.writeFile(fullPath, new TextEncoder().encode(file.content))
      }
      setFilesLoaded(true)
      console.log("[Python Preview] Files loaded")
      terminalTabs.forEach((tab) => {
        const term = terminals.current.get(tab.id)
        if (term) {
          term.writeln("\n✓ Files loaded! Run 'exec(open(\"main.py\").read())' to test your code.")
        }
      })
    } catch (error) {
      console.error("[Python Preview] File load error:", error)
    }
  }, [effectiveFiles, filesKey, terminalTabs, projectType])

  useEffect(() => {
    loadFilesIntoPyodide()
  }, [loadFilesIntoPyodide])

  const initTerminalForTab = useCallback(
    async (tabId: number) => {
      if (projectType !== "python") return
      const dom = terminalRefs.current.get(tabId)
      if (!dom || terminals.current.has(tabId)) return

      try {
        const { Terminal } = await import("@xterm/xterm")
        const { FitAddon } = await import("@xterm/addon-fit")

        const term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: { background: "#000000", foreground: "#ffffff" },
          convertEol: true,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(dom)
        fitAddon.fit()

        terminals.current.set(tabId, term)
        fitAddons.current.set(tabId, fitAddon)

        replBuffers.current.set(tabId, { buffer: "", prompt: ">>> " })

        if (pyodideReady) {
          setupPyodideREPL(tabId, term)
        }

        console.log(`[Python Preview] Terminal ${tabId} ready`)
      } catch (error) {
        console.error(`[Python Preview] Terminal init error for ${tabId}:`, error)
      }
    },
    [pyodideReady, projectType],
  )

  const setupPyodideREPL = useCallback(
    (tabId: number, term: any) => {
      const bufferInfo = replBuffers.current.get(tabId)
      if (!bufferInfo) return

      pyodideRef.current.runPython(`
import sys
class StdoutRedirect:
    def __init__(self, write_func):
        self.write_func = write_func
    def write(self, text):
        self.write_func(text)
    def flush(self):
        pass
sys.stdout = StdoutRedirect(lambda text: js.term_write(text))
`)

      term.writeln("\nPython 3.12 REPL (Pyodide)")
      term.writeln("Files loaded. Ready to run code!")
      term.write(bufferInfo.prompt)

      const onData = (data: string) => {
        const char = data.charCodeAt(0)
        if (char === 13) {
          term.write("\r\n")
          const code = bufferInfo.buffer + "\n"
          bufferInfo.buffer = ""
          pyodideRef.current
            .runPythonAsync(code)
            .then((result: any) => {
              if (result !== undefined) term.write(result.toString() + "\r\n")
            })
            .catch((error: any) => {
              const errorMsg = error.message || String(error)
              term.write(errorMsg + "\r\n")

              const fileMatch = errorMsg.match(/File "(.+?)", line (\d+)/)
              onError?.({
                message: errorMsg,
                file: fileMatch?.[1],
                line: fileMatch?.[2],
              })
            })
          term.write(bufferInfo.prompt)
        } else if (char === 127 || char === 8) {
          if (bufferInfo.buffer.length > 0) {
            bufferInfo.buffer = bufferInfo.buffer.slice(0, -1)
            term.write("\b \b")
          }
        } else if (char >= 32 && char <= 126) {
          bufferInfo.buffer += data
          term.write(data)
        }
      }
      term.onData(onData)
      ;(term as any).disposeOnData = onData
    },
    [onError],
  )

  const addTab = useCallback(() => {
    if (projectType !== "python") return
    const newId = Date.now()
    setTerminalTabs((prev) => [...prev, { id: newId, title: `REPL ${prev.length + 1}` }])
    setActiveTerminalTab(newId)
  }, [projectType])

  const fetchFiles = useCallback(async () => {
    try {
      const token = await getToken()
      let url = `/api/projects/${projectId}/files`
      if (currentVersion) {
        url += `?version=${currentVersion}`
      }

      console.log("[v0] Fetching files for project:", projectId, "isGitHubImport:", isGitHubImport)

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const { files: newFiles, isGitHubImport: fromServer } = await response.json()

      console.log("[v0] Received", newFiles.length, "files from server")

      setFiles(newFiles || [])
      if (newFiles.length > 0 && !selectedFile) {
        if (isGitHubImport || fromServer) {
          const entryFile = newFiles.find(
            (f: any) =>
              f.path.match(/^(src\/)?App\.(tsx?|jsx?)$/) ||
              f.path.match(/^(src\/)?index\.(tsx?|jsx?)$/) ||
              f.path.match(/^(src\/)?main\.(tsx?|jsx?)$/),
          )
          setSelectedFile(entryFile || newFiles[0])
        } else {
          setSelectedFile(newFiles[newFiles.length - 1])
        }
      }
    } catch (error) {
      console.error("[Code Preview] Fetch files error:", error)
    }
  }, [projectId, getToken, selectedFile, currentVersion, isGitHubImport])

  const handleSave = useCallback(async () => {
    if (projectType !== "python" || !selectedFile || editedContent === selectedFile.content) return
    try {
      const token = await getToken()
      await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(selectedFile.path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: editedContent }),
      })
      await fetchFiles()
    } catch (error) {
      console.error("[Code Preview] Save error:", error)
    }
  }, [selectedFile, editedContent, projectId, getToken, fetchFiles, projectType])

  const handleDownload = useCallback(async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    effectiveFiles.forEach((file) => zip.file(file.path, file.content))
    const content = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(content)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectId}${currentVersion ? `-v${currentVersion}` : ""}.zip`
    a.click()
    URL.revokeObjectURL(url)
    setShowDownloadMenu(false)
  }, [effectiveFiles, projectId, currentVersion])

  useEffect(() => {
    fetchFiles()
    const interval = setInterval(fetchFiles, 5000)
    return () => clearInterval(interval)
  }, [fetchFiles])

  useEffect(() => {
    if (projectType === "python" && selectedFile) setEditedContent(selectedFile.content)
  }, [selectedFile, projectType])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (projectType === "python" && (e.ctrlKey || e.metaKey) && e.key === "s" && isEditorFocused) {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isEditorFocused, handleSave, projectType])

  const handleSearch = useCallback(async () => {
    if (projectType !== "python" || !searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const token = await getToken()
      const response = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const { results } = await response.json()
      setSearchResults(results || [])
    } catch (error) {
      console.error("[Code Preview] Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, projectId, getToken, projectType])

  useEffect(() => {
    const timeout = setTimeout(handleSearch, 300)
    return () => clearTimeout(timeout)
  }, [handleSearch])

  const isDirty = projectType === "python" && selectedFile ? editedContent !== selectedFile.content : false

  const editorOptions = useMemo(
    () => ({
      wordWrap: "on",
      fontSize: 13,
      fontFamily: 'Monaco, "Cascadia Code", monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
    }),
    [],
  )

  if (!isOpen) return null

  return (
    <div className="h-full flex flex-col border border-[#d6d6d6] rounded-md bg-[#ffffff] relative overflow-hidden">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 p-1 bg-white/80 hover:bg-gray-100 rounded transition-colors"
        aria-label="Close preview"
      >
        <X className="w-4 h-4" />
      </button>

      {isCodeGenerating && (
        <div className="absolute inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">Creating the files...</p>
              <p className="text-sm text-gray-600">Please wait while the files are being created</p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
        <MainHeader
          showDownloadMenu={showDownloadMenu}
          setShowDownloadMenu={setShowDownloadMenu}
          handleDownload={handleDownload}
          refreshFilesAndPreview={fetchFiles}
          projectId={projectId}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {projectType === null ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Loader2 className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading project...</p>
              </div>
            </div>
          ) : projectType === "python" ? (
            <>
              <TabsContent
                value="preview"
                className="flex-1 m-0 flex flex-col overflow-hidden rounded-bl-lg border-t border-gray-200"
              >
                {!pyodideReady ? (
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto mb-3"></div>
                      <p className="text-sm text-gray-500">Loading Pyodide Python runtime...</p>
                    </div>
                  </div>
                ) : effectiveFiles.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center bg-black text-white">
                    <div className="text-center">
                      <p className="text-sm">Waiting for AI to generate Python files...</p>
                      <p className="text-xs text-gray-400 mt-1">Switch to Code tab to edit.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col bg-[#202020]">
                    <div className="px-3 py-2 bg-white text-white text-sm flex items-center justify-between border-b border-gray-700">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TerminalIcon className="w-4 h-4 flex-shrink-0 text-black" />
                        <div className="flex items-center gap-1 flex-1 overflow-hidden">
                          {terminalTabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTerminalTab(tab.id)}
                              className={`px-2 py-1 text-xs rounded whitespace-nowrap overflow-hidden text-ellipsis ${
                                activeTerminalTab === tab.id
                                  ? "bg-[#dad8d8] hover:bg-[#e7e7e7] text-black"
                                  : "bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black"
                              }`}
                              title={tab.title}
                            >
                              {tab.title}
                            </button>
                          ))}
                          <button
                            onClick={addTab}
                            className="p-1 bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black rounded flex-shrink-0"
                            title="New REPL"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {!filesLoaded && <span className="text-xs text-gray-400">(Loading files...)</span>}
                    </div>
                    <div className="flex-1 relative">
                      {terminalTabs.map((tab) => (
                        <div
                          key={tab.id}
                          ref={(el) => {
                            if (el && !terminalRefs.current.has(tab.id)) {
                              terminalRefs.current.set(tab.id, el)
                              initTerminalForTab(tab.id)
                            }
                          }}
                          className={`absolute inset-0 px-4 text-black ${activeTerminalTab === tab.id ? "block" : "hidden"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="code"
                className="flex-1 m-0 flex overflow-hidden rounded-bl-lg border-t border-gray-200"
              >
                <CodeTab
                  sidebarView={sidebarView}
                  setSidebarView={setSidebarView}
                  files={effectiveFiles}
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
                  loading={!pyodideReady}
                />
              </TabsContent>

              <TabsContent
                value="settings"
                className="flex-1 m-0 flex overflow-hidden rounded-bl-lg border-t border-gray-200"
              >
                <SettingsTab projectId={projectId} />
              </TabsContent>
            </>
          ) : (
            <SandpackProvider
              files={sandpackFiles}
              template={template}
              theme={"light"}
              customSetup={{
                dependencies: defaultDependencies,
              }}
              options={{ externalResources: ["https://cdn.tailwindcss.com"] }}
            >
              <div className="h-[100vh] flex flex-col overflow-hidden">
                <TabsContent
                  value="preview"
                  className="flex-1 m-0 p-0 border-t border-gray-200 overflow-hidden rounded-bl-lg"
                >
                  <SandpackPreviewClient />
                </TabsContent>

                <TabsContent
                  value="code"
                  className="flex-1 m-0 p-0 border-t border-gray-200 overflow-hidden rounded-bl-lg flex"
                >
                  <SandpackFileExplorer style={{ height: "100%", width: "300px" }} />
                  <SandpackCodeEditor style={{ height: "100%", flex: 1 }} />
                </TabsContent>

                <TabsContent
                  value="settings"
                  className="flex-1 m-0 flex overflow-hidden rounded-bl-lg border-t border-gray-200"
                >
                  <SettingsTab projectId={projectId} />
                </TabsContent>
                <TabsContent
                  value="database"
                  className="flex-1 m-0 flex overflow-hidden rounded-bl-lg border-t border-gray-200"
                >
                  <DatabasePanel projectId={projectId} />
                </TabsContent>
              </div>
            </SandpackProvider>
          )}
        </div>
      </Tabs>
    </div>
  )
}