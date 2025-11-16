"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState, useRef, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MainHeader } from "./main-header"
import { CodeTab } from "./code-tab"
import { PreviewTab } from "./preview-tab"
import { useAuth } from "@clerk/nextjs"

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
      } catch (error) {
        console.error("[v0] Failed to create preview:", error)
        await fetchFiles()
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
      </Tabs>
    </div>
  )
}















// "use client"

// import { cn } from "@/lib/utils"
// import { useEffect, useState, useRef, useMemo } from "react"
// import { Loader2, X } from "lucide-react"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { MainHeader } from "./main-header"
// import { CodeTab } from "./code-tab"
// import { PreviewTab } from "./preview-tab"
// import { useAuth } from "@clerk/nextjs"

// // Singleton WebContainer instance (shared across instances - suitable for single-project view)
// let webcontainerInstance: any = null
// let bootPromise: Promise<any> | null = null
// async function getWebContainerInstance() {
//   if (webcontainerInstance) {
//     return webcontainerInstance
//   }
//   if (bootPromise) {
//     return bootPromise
//   }
//   bootPromise = (async () => {
//     const { WebContainer } = await import("@webcontainer/api")
//     // Boot with a consistent workdir name to avoid random IDs (mounts files here by default)
//     webcontainerInstance = await WebContainer.boot({
//       workdirName: 'project-root'
//     })
//     return webcontainerInstance
//   })()
//   return bootPromise
// }

// interface CodePreviewProps {
//   projectId: string
// }

// export function CodePreview({ projectId }: CodePreviewProps) {
//   const [loading, setLoading] = useState(true)
//   const [previewUrl, setPreviewUrl] = useState<string | null>(null)
//   const [container, setContainer] = useState<any>(null)
//   const [terminal, setTerminal] = useState<any | null>(null)
//   const [terminalReady, setTerminalReady] = useState(false)
//   const [showTerminal, setShowTerminal] = useState(false)
//   const [files, setFiles] = useState<
//     Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
//   >([])
//   const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null)
//   const [editedContent, setEditedContent] = useState("")
//   const [isEditorFocused, setIsEditorFocused] = useState(false)
//   const [sidebarView, setSidebarView] = useState<"files" | "search">("files")
//   const [searchQuery, setSearchQuery] = useState("")
//   const [searchResults, setSearchResults] = useState<any[]>([])
//   const [isSearching, setIsSearching] = useState(false)
//   const [showDownloadMenu, setShowDownloadMenu] = useState(false)
//   const [devProcess, setDevProcess] = useState<any>(null) // Track dev process for restarts

//   const scrollRef = useRef<HTMLDivElement>(null)
//   const previousScrollTop = useRef(0)
//   const monacoRef = useRef<any>(null)
//   const terminalRef = useRef<HTMLDivElement>(null)
//   const fitAddonRef = useRef<any>(null)
//   const shellProcessRef = useRef<any>(null)
//   const { getToken } = useAuth()

//   // Helper to build FileSystemTree from flat files array (strip leading / for relative paths)
//   const buildFileSystemTree = (files: Array<{ path: string; content: string }>): Record<string, any> => {
//     const tree: Record<string, any> = {}

//     files.forEach(({ path, content }) => {
//       // Strip leading / to ensure relative mount paths
//       const cleanPath = path.replace(/^\//, '')
//       const parts = cleanPath.split('/').filter(Boolean)
//       let current: Record<string, any> = tree

//       for (let i = 0; i < parts.length - 1; i++) {
//         const dir = parts[i]
//         if (!current[dir]) {
//           current[dir] = { directory: {} }
//         }
//         current = current[dir].directory
//       }

//       const filename = parts[parts.length - 1]
//       if (filename) {
//         current[filename] = { file: { contents: content } }
//       }
//     })

//     return tree
//   }

//   // Patch package.json to disable Turbopack and set port (use relative path)
//   const patchPackageJson = async (wc: any) => {
//     try {
//       const packageContent = await wc.fs.readFile('package.json', 'utf-8')
//       const pkg = JSON.parse(packageContent)
//       if (!pkg.scripts.dev.includes('--no-turbo')) {
//         pkg.scripts.dev = 'next dev --no-turbo --port 3000'
//         await wc.fs.writeFile('package.json', JSON.stringify(pkg, null, 2))
//         console.log('[WebContainers] Patched package.json: Disabled Turbopack')
//         if (terminal) terminal.writeln('\n[Patch] Disabled Turbopack for compatibility')
//       }
//     } catch (err) {
//       console.warn('[WebContainers] Could not patch package.json:', err)
//     }
//   }

//   const fetchFiles = async () => {
//     try {
//       const token = await getToken()
//       const filesResponse = await fetch(`/api/projects/${projectId}/files`, {
//         headers: { Authorization: `Bearer ${token}` },
//       })
//       if (!filesResponse.ok) throw new Error(`HTTP ${filesResponse.status}`)
//       const { files: newFiles = [] } = await filesResponse.json()

//       console.log('[Debug] Files details:', newFiles.map(f => ({ path: f.path, size: f.content.length, startsWith: f.content.substring(0, 50) })))

//       if (scrollRef.current) previousScrollTop.current = scrollRef.current.scrollTop
//       setFiles(newFiles)

//       if (newFiles.length > 0) {
//         const latestFile = newFiles[newFiles.length - 1]
//         setSelectedFile((prev) => {
//           if (!prev) return latestFile
//           const stillExists = newFiles.find((f: any) => f.path === prev.path)
//           if (!stillExists) return latestFile
//           const updated = newFiles.find((f: any) => f.path === prev.path)
//           return updated || prev
//         })
//       }
//     } catch (error) {
//       console.error("[v0] Failed to fetch files:", error)
//     }
//   }

//   const initContainer = async () => {
//     if (files.length === 0) {
//       console.warn('[WebContainers] No files to mount')
//       setLoading(false)
//       return
//     }

//     setLoading(true)
//     setPreviewUrl(null)

//     try {
//       console.log('[WebContainers] Booting...')
//       // Use singleton instance with consistent workdir
//       const wc = await getWebContainerInstance()
//       console.log('[WebContainers] Booted successfully (singleton)')

//       const filesToMount = files.filter((file) => file.path && typeof file.content === 'string')
//         .map((file) => ({ path: file.path, content: file.content }))
//       console.log('[WebContainers] Mounting', filesToMount.length, 'files')
//       const tree = buildFileSystemTree(filesToMount)
//       // Mount at default workdir (relative paths will resolve here)
//       await wc.mount(tree)
//       console.log('[WebContainers] Mounted')

//       // Verify mount with relative path (resolves to workdir/package.json)
//       try {
//         const pkgContent = await wc.fs.readFile('package.json', 'utf-8')
//         console.log('[Debug] Mounted package.json exists:', !!pkgContent, 'Content preview:', pkgContent.substring(0, 100))
//       } catch (e) {
//         console.error('[Debug] Mount failed for package.json:', e)
//       }

//       const hasPackageJson = files.some((f) => f.path.replace(/^\//, '') === 'package.json')
//       if (hasPackageJson) {
//         await patchPackageJson(wc) // Uses relative paths
//       }

//       setContainer(wc)

//       if (terminalReady && hasPackageJson) {
//         runAutoCommands(wc)
//       } else if (hasPackageJson) {
//         const checkReady = setInterval(() => {
//           if (terminalReady) {
//             clearInterval(checkReady)
//             runAutoCommands(wc)
//           }
//         }, 500)
//       }

//       setLoading(false)
//     } catch (error) {
//       console.error('[WebContainers] Init error:', error)
//       setLoading(false)
//     }
//   }

//   const runAutoCommands = async (wc: any) => {
//     if (!terminal) return

//     // Install (default cwd is workdir where files are mounted - no cd needed)
//     terminal.writeln('\n[Auto-run] $ npm install')
//     const installProcess = await wc.spawn('npm', ['install', '--legacy-peer-deps'])
//     let installProgress = 0
//     installProcess.output.pipeTo(new WritableStream({
//       write(data) {
//         // Ensure data is Uint8Array for terminal.write (fix invalid chunk warnings)
//         if (typeof data === 'string') data = new TextEncoder().encode(data)
//         const chunk = new TextDecoder().decode(data)
//         terminal.write(data)
//         // Rough progress: Parse for "added X packages"
//         const addedMatch = chunk.match(/added (\d+) packages?/)
//         if (addedMatch) installProgress = Math.min(100, (parseInt(addedMatch[1]) / 200) * 100) // Assume ~200 pkgs max
//         console.log(`[WebContainers] Install progress: ~${installProgress}%`)
//       },
//     }))
//     const installExit = await installProcess.exit
//     if (installExit !== 0) {
//       terminal.writeln('\n[Auto-run] npm install failed - check deps')
//       return
//     }
//     terminal.writeln('\n[Auto-run] ✓ Dependencies installed')

//     // Dev server (default cwd)
//     terminal.writeln('\n[Auto-run] $ npm run dev')
//     const devProc = await wc.spawn('npm', ['run', 'dev'])
//     setDevProcess(devProc)
//     devProc.output.pipeTo(new WritableStream({
//       write(data) {
//         if (typeof data === 'string') data = new TextEncoder().encode(data)
//         const chunk = new TextDecoder().decode(data)
//         terminal.write(data)
//         if (chunk.includes('Local:') || chunk.includes('ready - started server on') || chunk.includes(':3000')) {
//           const portMatch = chunk.match(/:(\d+)/)
//           if (portMatch && !previewUrl) {
//             const port = portMatch[1]
//             const url = `http://localhost:${port}`
//             setPreviewUrl(url)
//             terminal.writeln(`\n✓ Server ready: ${url}`)
//           }
//         }
//       }
//     }))

//     wc.on('server-ready', (port: number, url: string) => {
//       if (!previewUrl) {
//         setPreviewUrl(url)
//         terminal.writeln(`\n✓ Server ready event: ${url}`)
//       }
//     })

//     // Hang detection: Restart if no preview after 90s
//     setTimeout(() => {
//       if (!previewUrl && devProc) {
//         console.log('[WebContainers] Dev hang detected - restarting')
//         devProc.kill()
//         setTimeout(() => runAutoCommands(wc), 2000) // Retry once
//       }
//     }, 90000)
//   }

//   // Terminal init (async to avoid SSR)
//   useEffect(() => {
//     if (!terminalRef.current || terminal || !container || !showTerminal) return

//     const initTerminal = async () => {
//       try {
//         const { Terminal } = await import("@xterm/xterm")
//         const { FitAddon } = await import("@xterm/addon-fit")
//         const term = new Terminal({
//           cursorBlink: true,
//           fontSize: 13,
//           fontFamily: 'Menlo, Monaco, "Courier New", monospace',
//           theme: { background: "#1e1e1e", foreground: "#d4d4d4" },
//           convertEol: true,
//         })
//         const fitAddon = new FitAddon()
//         term.loadAddon(fitAddon)
//         term.open(terminalRef.current)
//         setTimeout(() => fitAddon.fit(), 100)
//         fitAddonRef.current = fitAddon
//         setTerminal(term)
//         setTerminalReady(true)

//         const handleResize = () => fitAddon.fit()
//         window.addEventListener("resize", handleResize)
//         return () => window.removeEventListener("resize", handleResize)
//       } catch (error) {
//         console.error("[v0] Terminal init failed:", error)
//       }
//     }

//     initTerminal()
//   }, [container, showTerminal])

//   // Shell start (default cwd=workdir, no explicit cwd needed)
//   useEffect(() => {
//     if (!container || !terminal || !terminalReady || shellProcessRef.current) return

//     const startShell = async () => {
//       try {
//         const shellProcess = await container.spawn("jsh", {
//           terminal: { cols: terminal.cols, rows: terminal.rows },
//         })
//         shellProcessRef.current = shellProcess

//         shellProcess.output.pipeTo(new WritableStream({ 
//           write: (data) => {
//             if (typeof data === 'string') data = new TextEncoder().encode(data)
//             terminal.write(data)
//           }
//         }))
//         const input = shellProcess.input.getWriter()
//         terminal.onData((data: string) => input.write(data))

//         terminal.writeln("Welcome to WebContainer Terminal!\nType 'npm install' or 'npm run dev' to run commands.\n")
//         // Auto-run only if files present (but shell starts regardless)
//         if (files.length > 0 && files.some(f => f.path.replace(/^\//, '') === 'package.json')) {
//           runAutoCommands(container)
//         }
//       } catch (error) {
//         console.error("[v0] Shell failed:", error)
//       }
//     }

//     startShell()
//   }, [container, terminal, terminalReady, files.length])

//   // File syncs (use relative paths, strip leading /)
//   useEffect(() => {
//     if (!container || files.length === 0) return
//     const updateFiles = async () => {
//       try {
//         for (const file of files.filter(f => f.path && typeof f.content === 'string')) {
//           const relPath = file.path.replace(/^\//, '')
//           await container.fs.writeFile(relPath, file.content)
//         }
//         console.log('[WebContainers] Synced files')
//         if (terminal) terminal.writeln('\n[Sync] Files updated')
//       } catch (err) {
//         console.error('[WebContainers] Sync failed:', err)
//       }
//     }
//     updateFiles()
//   }, [files, container])

//   // Hot-reload edits (use relative path)
//   useEffect(() => {
//     if (!selectedFile?.path || !container || editedContent === selectedFile.content) return
//     const writeEdit = async () => {
//       try {
//         const relPath = selectedFile.path.replace(/^\//, '')
//         await container.fs.writeFile(relPath, editedContent)
//         console.log(`[WebContainers] Hot-reloaded ${relPath}`)
//         if (terminal) terminal.writeln(`\n[Edit] Updated ${selectedFile.path}`)
//       } catch (err) {
//         console.error(`[WebContainers] Edit failed:`, err)
//       }
//     }
//     writeEdit()
//   }, [editedContent, selectedFile?.path, container])

//   const handleSave = async () => {
//     if (!selectedFile || editedContent === selectedFile.content) return
//     try {
//       const token = await getToken()
//       await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(selectedFile.path)}`, {
//         method: 'PUT',
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ content: editedContent }),
//       })
//       await fetchFiles()
//     } catch (error) {
//       console.error("[v0] Save failed:", error)
//     }
//   }

//   const handleDownload = async () => {
//     const JSZip = (await import('jszip')).default
//     const zip = new JSZip()
//     files.forEach((file) => zip.file(file.path, file.content))
//     const content = await zip.generateAsync({ type: 'blob' })
//     const url = URL.createObjectURL(content)
//     const a = document.createElement('a')
//     a.href = url
//     a.download = `${projectId}.zip`
//     a.click()
//     URL.revokeObjectURL(url)
//     setShowDownloadMenu(false)
//   }

//   // Polling
//   useEffect(() => {
//     fetchFiles()
//     const pollInterval = setInterval(fetchFiles, 2000)
//     return () => clearInterval(pollInterval)
//   }, [projectId, getToken])

//   // Init container
//   useEffect(() => {
//     if (files.length > 0 && !container) {
//       console.log('Files ready, init container')
//       initContainer()
//     }
//   }, [files.length])

//   useEffect(() => {
//     if (selectedFile) setEditedContent(selectedFile.content)
//   }, [selectedFile?.path, selectedFile?.content])

//   useEffect(() => {
//     if (scrollRef.current && previousScrollTop.current > 0) {
//       requestAnimationFrame(() => scrollRef.current?.scrollTo(0, previousScrollTop.current))
//     }
//   }, [files, selectedFile])

//   // Cleanup (avoid teardown of singleton)
//   useEffect(() => {
//     return () => {
//       devProcess?.kill?.()
//       if (terminal) terminal.dispose()
//       setContainer(null)
//       setTerminal(null)
//       setPreviewUrl(null)
//       setDevProcess(null)
//     }
//   }, [projectId])

//   // Ctrl+S
//   useEffect(() => {
//     const handleKeyDown = (e: KeyboardEvent) => {
//       if (e.ctrlKey && e.key === 's' && isEditorFocused) {
//         e.preventDefault()
//         e.stopPropagation()
//         handleSave()
//       }
//     }
//     document.addEventListener('keydown', handleKeyDown, true)
//     return () => document.removeEventListener('keydown', handleKeyDown, true)
//   }, [isEditorFocused, handleSave])

//   const handleSearch = async () => {
//     if (!searchQuery.trim()) {
//       setSearchResults([])
//       return
//     }
//     setIsSearching(true)
//     try {
//       const token = await getToken()
//       const response = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(searchQuery)}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       })
//       if (!response.ok) throw new Error(`HTTP ${response.status}`)
//       const { results = [] } = await response.json()
//       setSearchResults(results)
//     } catch (error) {
//       console.error("[v0] Search failed:", error)
//     } finally {
//       setIsSearching(false)
//     }
//   }

//   useEffect(() => {
//     const debounce = setTimeout(() => searchQuery.trim() ? handleSearch() : setSearchResults([]), 300)
//     return () => clearTimeout(debounce)
//   }, [searchQuery, getToken])

//   const highlightMatch = (text: string, matches: { start: number; end: number }[]) => {
//     if (!matches?.length) return text
//     let lastIndex = 0
//     const parts = []
//     matches.forEach((match) => {
//       parts.push(text.slice(lastIndex, match.start))
//       parts.push(<mark key={match.start} className="bg-yellow-500/30">{text.slice(match.start, match.end)}</mark>)
//       lastIndex = match.end
//     })
//     parts.push(text.slice(lastIndex))
//     return parts
//   }

//   const isDirty = selectedFile ? editedContent !== selectedFile.content : false

//   const editorOptions = useMemo(() => ({
//     wordWrap: 'on',
//     fontSize: 13,
//     fontFamily: 'Monaco, \'Cascadia Code\', monospace',
//     minimap: { enabled: false },
//     scrollBeyondLastLine: false,
//     automaticLayout: true,
//   }), [])

//   const toggleTerminal = () => {
//     setShowTerminal(!showTerminal)
//     setTimeout(() => fitAddonRef.current?.fit?.(), 150)
//   }

//   return (
//     <div className="h-full flex flex-col border border-[#d6d6d6] rounded-md bg-[#ffffff] relative overflow-hidden">
//       <div className="absolute left-0 top-0 h-full w-1 bg-gray-500 opacity-0 hover:opacity-30 pointer-events-none rounded-l"></div>

//       <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
//         <MainHeader
//           previewUrl={previewUrl}
//           showDownloadMenu={showDownloadMenu}
//           setShowDownloadMenu={setShowDownloadMenu}
//           handleDownload={handleDownload}
//           toggleTerminal={toggleTerminal}
//         />
//         <PreviewTab loading={loading} previewUrl={previewUrl} />
//         <CodeTab
//           sidebarView={sidebarView}
//           setSidebarView={setSidebarView}
//           files={files}
//           selectedFile={selectedFile}
//           setSelectedFile={setSelectedFile}
//           editedContent={editedContent}
//           setEditedContent={setEditedContent}
//           isEditorFocused={isEditorFocused}
//           setIsEditorFocused={setIsEditorFocused}
//           searchQuery={searchQuery}
//           setSearchQuery={setSearchQuery}
//           searchResults={searchResults}
//           isSearching={isSearching}
//           highlightMatch={highlightMatch}
//           isDirty={isDirty}
//           handleSave={handleSave}
//           projectId={projectId}
//           fetchFiles={fetchFiles}
//           scrollRef={scrollRef}
//           monacoRef={monacoRef}
//           editorOptions={editorOptions}
//           loading={loading}
//         />
//         {showTerminal && (
//           <div className="h-56 border-t border-[#444547]">
//             <div className="px-3 py-2 bg-[#1e1e1e] text-white text-sm flex items-center justify-between">
//               <div className="flex items-center gap-2">
//                 <Loader2 className="w-4 h-4 animate-spin" />
//                 <span>Terminal</span>
//                 {!terminalReady && <span className="text-xs text-gray-400">(Loading...)</span>}
//               </div>
//               <button
//                 onClick={() => setShowTerminal(false)}
//                 className="p-1 hover:bg-[#3e3f42] text-white rounded transition-colors"
//               >
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//             <div ref={terminalRef} className="h-[calc(100%-40px)] overflow-hidden bg-[#1e1e1e] border border-[#444547]" />
//           </div>
//         )}
//       </Tabs>
//     </div>
//   )
// }