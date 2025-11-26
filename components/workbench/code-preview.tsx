"use client"
import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { Loader2, TerminalIcon, X, Plus } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { MainHeader } from "./main-header"
import { CodeTab } from "./code-tab"
import { SettingsTab } from "./settings-tab"
import { useAuth } from "@clerk/nextjs"
import { getWebContainerInstance } from "@/lib/webcontainer-singleton"
import { detectPackagesFromFiles, getPackageInstallCommand } from "@/lib/package-detector"

interface CodePreviewProps {
  projectId: string
}

interface TerminalTab {
  id: number
  title: string
}

export function CodePreview({ projectId }: CodePreviewProps) {
  // State management
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

  const [webcontainer, setWebcontainer] = useState<any>(null)
  const [containerReady, setContainerReady] = useState(false)
  const [terminalReady, setTerminalReady] = useState(false)
  const [showTerminal, setShowTerminal] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  // Terminal tabs state
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([{ id: 1, title: "Shell 1" }])
  const [activeTerminalTab, setActiveTerminalTab] = useState(1)
  const activeTabRef = useRef(1)

  // Refs for terminals
  const terminals = useRef<Map<number, any>>(new Map())
  const fitAddons = useRef<Map<number, any>>(new Map())
  const shellProcesses = useRef<Map<number, any>>(new Map())
  const terminalRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  const previousScrollTop = useRef(0)
  const monacoRef = useRef<any>(null)
  const listenerAdded = useRef(false)
  const { getToken } = useAuth()

  // Highlight match function for search results
  const highlightMatch = useCallback((text: string, matches: { start: number; end: number }[]) => {
    let result = text;
    matches.forEach(({ start, end }) => {
      const before = result.substring(0, start);
      const match = result.substring(start, end);
      const after = result.substring(end);
      result = `${before}<mark>${match}</mark>${after}`;
    });
    return <div dangerouslySetInnerHTML={{ __html: result }} />;
  }, []);

  // Update active tab ref
  useEffect(() => {
    activeTabRef.current = activeTerminalTab
  }, [activeTerminalTab])

  // Global resize handler for all terminals
  useEffect(() => {
    const handleResize = () => {
      fitAddons.current.forEach((fa) => {
        if (fa) {
          setTimeout(() => fa.fit(), 100)
        }
      })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Initialize terminals for tabs
  const initTerminalForTab = useCallback(
    async (tabId: number) => {
      if (terminalRefs.current.has(tabId)) {
        const dom = terminalRefs.current.get(tabId)
        if (!dom || terminals.current.has(tabId)) return

        try {
          console.log(`[v0] Initializing terminal for tab ${tabId}...`)
          const { Terminal } = await import("@xterm/xterm")
          const { FitAddon } = await import("@xterm/addon-fit")

          const term = new Terminal({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
              background: "#ffffff",
              foreground: "#000000",
            },
            convertEol: true,
          })

          const fitAddon = new FitAddon()
          term.loadAddon(fitAddon)
          term.open(dom)

          setTimeout(() => {
            fitAddon.fit()
          }, 100)

          terminals.current.set(tabId, term)
          fitAddons.current.set(tabId, fitAddon)

          if (!terminalReady) {
            setTerminalReady(true)
          }

          console.log(`[v0] Terminal initialized successfully for tab ${tabId}`)

          // Start shell if container is ready
          if (containerReady && webcontainer) {
            startShellForTab(tabId)
          }
        } catch (error) {
          console.error(`[v0] Failed to initialize terminal for tab ${tabId}:`, error)
        }
      }
    },
    [containerReady, webcontainer, terminalReady]
  )

  // Start shell for a specific tab
  const startShellForTab = async (tabId: number) => {
    if (!webcontainer || !terminals.current.has(tabId) || shellProcesses.current.has(tabId)) return

    const term = terminals.current.get(tabId)
    try {
      console.log(`[v0] Starting shell process for tab ${tabId}...`)
      const shellProcess = await webcontainer.spawn("jsh", {
        terminal: {
          cols: term.cols,
          rows: term.rows,
        },
      })

      shellProcesses.current.set(tabId, shellProcess)

      shellProcess.output.pipeTo(
        new WritableStream({
          write(data: any) {
            term.write(data)
          },
        })
      )

      const input = shellProcess.input.getWriter()
      term.onData((data: string) => {
        input.write(data)
      })

      term.writeln("Welcome to WebContainer Terminal!")
      term.writeln("Type commands to interact with your project.")
      term.writeln("")

      console.log(`[v0] Shell connected successfully for tab ${tabId}`)
    } catch (error) {
      console.error(`[v0] Failed to start shell for tab ${tabId}:`, error)
      term?.writeln(`Error starting shell: ${error}`)
    }
  }

  // Add new terminal tab
  const addTab = () => {
    const newId = Date.now()
    const newTitle = `Shell ${terminalTabs.length + 1}`
    setTerminalTabs((prev) => [...prev, { id: newId, title: newTitle }])
    setActiveTerminalTab(newId)
  }

  // Fetch files from API
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

  useEffect(() => {
    let mounted = true

    const initWebContainer = async () => {
      try {
        console.log("[v0] Starting WebContainer initialization...")
        const instance = await getWebContainerInstance()

        if (mounted) {
          setWebcontainer(instance)
          setContainerReady(true)
          console.log("[v0] WebContainer initialized successfully")
        }
      } catch (error) {
        console.error("[v0] Failed to initialize WebContainer:", error)
      }
    }

    initWebContainer()

    return () => {
      mounted = false
    }
  }, [])

  // Initialize terminals when tabs change
  useEffect(() => {
    terminalTabs.forEach((tab) => {
      if (!terminals.current.has(tab.id)) {
        initTerminalForTab(tab.id)
      }
    })
  }, [terminalTabs, initTerminalForTab])

  // Start shells for existing tabs when container becomes ready
  useEffect(() => {
    if (containerReady && webcontainer) {
      terminalTabs.forEach((tab) => {
        startShellForTab(tab.id)
      })
    }
  }, [containerReady, webcontainer, terminalTabs])

  // Set up global server-ready listener (only once)
  useEffect(() => {
    if (!containerReady || !webcontainer || listenerAdded.current) return

    const handleServerReady = (port: number, url: string) => {
      console.log("[v0] Server ready at:", url)
      const currentActive = activeTabRef.current
      const activeTerm = terminals.current.get(currentActive)
      activeTerm?.writeln(`\n✓ Server running at ${url}`)
      activeTerm?.writeln("✓ Preview is now live!")
      setPreviewUrl(url)
      setLoading(false)
    }

    webcontainer.on("server-ready", handleServerReady)
    listenerAdded.current = true

    // WebContainer does not support .off(), so no cleanup
  }, [containerReady, webcontainer])

  useEffect(() => {
    if (!webcontainer || !containerReady || files.length === 0) return

    const loadFiles = async () => {
      try {
        console.log("[v0] Loading files into WebContainer...", files.length, "files")

        const allFiles = [...files]
        const hasPackageJson = allFiles.some((f) => f.path === "package.json")

        if (!hasPackageJson) {
          const defaultPackageJson = {
            name: "nextjs-project",
            version: "0.1.0",
            private: true,
            scripts: {
              dev: "next dev --port 3000",
              build: "next build",
              start: "next start",
            },
            dependencies: {
              next: "^14.2.5",
              react: "^18.3.1",
              "react-dom": "^18.3.1",
            },
            devDependencies: {
              "@types/node": "^20",
              "@types/react": "^18",
              "@types/react-dom": "^18",
              typescript: "^5",
              tailwindcss: "^3.4.1",
              postcss: "^8",
              autoprefixer: "^10.4.19",
            },
          }
          allFiles.push({
            path: "package.json",
            content: JSON.stringify(defaultPackageJson, null, 2),
            language: 'json',
          })
        }

        const fileTree: any = {}

        for (const file of allFiles) {
          if (!file.path || typeof file.content !== "string") {
            console.warn("[v0] Skipping invalid file:", file.path || "undefined path")
            continue
          }

          const parts = file.path.split("/").filter((p) => p)
          if (parts.length === 0) {
            console.warn("[v0] Skipping file with empty path:", file.path)
            continue
          }

          let current = fileTree

          for (let i = 0; i < parts.length - 1; i++) {
            const dirName = parts[i]
            if (!dirName) {
              console.warn("[v0] Skipping file with invalid directory name in path:", file.path)
              continue
            }
            if (!current[dirName]) {
              current[dirName] = { directory: {} }
            }
            current = current[dirName].directory
          }

          const fileName = parts[parts.length - 1]
          if (!fileName) {
            console.warn("[v0] Skipping file with empty filename:", file.path)
            continue
          }

          current[fileName] = {
            file: {
              contents: file.content,
            },
          }
        }

        if (Object.keys(fileTree).length === 0) {
          console.error("[v0] No valid files to mount in WebContainer")
          return
        }

        console.log("[v0] File tree structure ready")
        await webcontainer.mount(fileTree)
        console.log("[v0] Files loaded successfully into WebContainer")

        // Auto-run dev server on first load
        if (!isRunning && files.length > 0) {
          setTimeout(() => {
            autoRunDevServer()
          }, 500)
        }
      } catch (error) {
        console.error("[v0] Error loading files:", error)
      }
    }

    loadFiles()
  }, [webcontainer, containerReady, files])

  const autoRunDevServer = async () => {
    if (!webcontainer || !containerReady || isRunning) {
      console.log("[v0] Cannot auto-run - container not ready or already running")
      return
    }

    const spawningTab = activeTerminalTab
    const targetTerm = terminals.current.get(spawningTab)
    if (!targetTerm) {
      console.log("[v0] No terminal for active tab")
      return
    }

    setIsRunning(true)

    const detectedPackages = detectPackagesFromFiles(files)
    console.log("[v0] Detected packages:", detectedPackages)

    targetTerm.writeln("\n$ npm install --legacy-peer-deps")

    try {
      const installProcess = await webcontainer.spawn("npm", ["install", "--legacy-peer-deps"])

      installProcess.output.pipeTo(
        new WritableStream({
          write(data: any) {
            targetTerm.write(data)
          },
        })
      )

      const installCode = await installProcess.exit

      if (installCode !== 0) {
        targetTerm.writeln("\n✗ Failed to install dependencies")
        setIsRunning(false)
        return
      }

      // Install detected packages
      if (detectedPackages.length > 0) {
        const installCmd = getPackageInstallCommand(detectedPackages)
        targetTerm.writeln(`\n$ ${installCmd}`)

        const additionalInstall = await webcontainer.spawn("npm", ["install", "--legacy-peer-deps", ...detectedPackages])

        additionalInstall.output.pipeTo(
          new WritableStream({
            write(data: any) {
              targetTerm.write(data)
            },
          })
        )

        const additionalCode = await additionalInstall.exit

        if (additionalCode !== 0) {
          targetTerm.writeln("\n⚠ Warning: Some additional packages failed to install")
        } else {
          targetTerm.writeln(`\n✓ Successfully installed ${detectedPackages.length} additional packages`)
        }
      }

      targetTerm.writeln("\n$ npm run dev")

      const devProcess = await webcontainer.spawn("npm", ["run", "dev"])

      devProcess.output.pipeTo(
        new WritableStream({
          write(data: any) {
            targetTerm.write(data)
          },
        })
      )

      // Server-ready handler is set globally
    } catch (error) {
      console.error("[v0] Error auto-running dev server:", error)
      targetTerm.writeln(`\n✗ Error: ${error}`)
      setIsRunning(false)
      setLoading(false)
    }
  }

  // Refresh files and preview
  const refreshFilesAndPreview = async () => {
    setLoading(true)
    try {
      setPreviewUrl(null)
      await fetchFiles()

      // Restart dev server
      if (isRunning) {
        setIsRunning(false)
      }

      setTimeout(() => {
        autoRunDevServer()
      }, 1000)
    } catch (error) {
      console.error("[v0] Refresh failed:", error)
    }
  }

  // Save file
  const handleSave = async () => {
    if (!selectedFile || editedContent === selectedFile.content) return

    try {
      const token = await getToken()
      await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(selectedFile.path)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editedContent }),
      })

      // Update file in WebContainer if it exists
      if (webcontainer && containerReady) {
        await webcontainer.fs.writeFile(selectedFile.path, editedContent)
      }

      await fetchFiles()
    } catch (error) {
      console.error("[v0] Failed to save file:", error)
    }
  }

  // Download project as ZIP
  const handleDownload = async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    files.forEach((file) => {
      zip.file(file.path, file.content)
    })
    const content = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(content)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectId}.zip`
    a.click()
    URL.revokeObjectURL(url)
    setShowDownloadMenu(false)
  }

  // Initial load
  useEffect(() => {
    const initPreview = async () => {
      try {
        await fetchFiles()
        setLoading(false)
      } catch (error) {
        console.error("[v0] Failed to initialize preview:", error)
        setLoading(false)
      }
    }

    initPreview()

    const pollInterval = setInterval(() => {
      fetchFiles()
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [projectId, getToken])

  // Update edited content when file changes
  useEffect(() => {
    if (selectedFile) {
      setEditedContent(selectedFile.content)
    }
  }, [selectedFile])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && isEditorFocused) {
      e.preventDefault()
      e.stopPropagation()
      handleSave()
    }
  }

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [isEditorFocused])

  // Search files
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

  // Search debounce
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

  const isDirty = selectedFile ? editedContent !== selectedFile.content : false

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

  return (
    <div className="h-full flex flex-col border border-[#d6d6d6] rounded-md bg-[#ffffff] relative overflow-hidden">
      <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
        <MainHeader
          previewUrl={previewUrl}
          showDownloadMenu={showDownloadMenu}
          setShowDownloadMenu={setShowDownloadMenu}
          handleDownload={handleDownload}
          refreshFilesAndPreview={refreshFilesAndPreview}
          projectId={projectId}
          showTerminal={showTerminal}
          setShowTerminal={setShowTerminal}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview Section */}
          <TabsContent
            value="preview"
            className="flex-1 m-0 flex overflow-hidden rounded-bl-1xl border-t border-[#4444442d]"
          >
            {loading ? (
              <div className="flex-1 flex items-center justify-center bg-[#f5f5f5]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-17 w-17  border-4 border-gray-200 border-t-black mx-auto mb-4"></div>
                  <p className="text-xs text-gray-400 mt-1">Running npm install and dev server</p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full flex-1 bg-white border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                style={{ border: "none" }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#f5f5f5]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-17 w-17  border-4 border-gray-200 border-t-black mx-auto mb-4"></div>
                  <p className="text-lg font-light text-gray-600">Waiting for server to start...</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Code Editor Section */}
          <TabsContent
            value="code"
            className="flex-1 m-0 flex overflow-hidden rounded-bl-3xl border-t border-[#4444442d]"
          >
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
          </TabsContent>

          {/* Settings Section */}
          <TabsContent
            value="settings"
            className="flex-1 m-0 flex overflow-hidden rounded-bl-3xl border-t border-[#4444442d]"
          >
            <SettingsTab projectId={projectId} />
          </TabsContent>

          {showTerminal && (
            <div className="h-56 border-t border-[#4444442d] flex flex-col">
              <div className="px-3 py-2 bg-[#ffffff] text-black text-sm flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TerminalIcon className="w-4 h-4 text-black flex-shrink-0" />
                  <div className="flex items-center gap-1 flex-1 overflow-hidden">
                    {terminalTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTerminalTab(tab.id)}
                        className={`px-2 py-0.5 text-xs rounded whitespace-nowrap overflow-hidden text-ellipsis ${
                          activeTerminalTab === tab.id
                            ? "bg-gray-200 font-medium"
                            : "hover:bg-gray-100"
                        }`}
                        title={tab.title}
                      >
                        {tab.title}
                      </button>
                    ))}
                    <button
                      onClick={addTab}
                      className="p-0.5 hover:bg-gray-100 text-black rounded transition-colors flex-shrink-0"
                      title="New tab"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {!terminalReady && <span className="text-xs text-gray-400">(Loading...)</span>}
                <button
                  onClick={() => setShowTerminal(false)}
                  className="p-1 hover:bg-[#e4e4e4] text-black rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 relative bg-[#ffffff]">
                {terminalTabs.map((tab) => (
                  <div
                    key={tab.id}
                    ref={(el) => {
                      if (el && !terminalRefs.current.has(tab.id)) {
                        terminalRefs.current.set(tab.id, el)
                        initTerminalForTab(tab.id)
                      }
                    }}
                    className={`absolute inset-0 overflow-x-hidden overflow-y-auto ${
                      activeTerminalTab === tab.id ? "block" : "hidden"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  )
}