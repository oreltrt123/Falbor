// components/workbench/editor-pane.tsx
"use client"

import { cn } from "@/lib/utils"
import { Save, Play, Loader2, ChevronRight, Database, X } from "lucide-react"
import * as React from "react"
import { FileSidebar } from "./file-sidebar"
import { useUser } from "@clerk/nextjs"
import { SupabaseConnectModal } from "@/components/models/supabase-connect-modal"
import dynamic from "next/dynamic"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

const Editor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  { ssr: false }
)

interface EditorPaneProps {
  selectedFile: { path: string; content: string } | null
  editedContent: string
  setEditedContent: (content: string) => void
  isEditorFocused: boolean
  setIsEditorFocused: (focused: boolean) => void
  isDirty: boolean
  handleSave: () => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  monacoRef: React.RefObject<any>
  editorOptions: any
  files: Array<{ path: string; content: string; language: string; type?: string; isLocked?: boolean }>
  setSelectedFile: (file: { path: string; content: string; language: string } | null) => void
  projectId: string
  fetchFiles: () => void
}

interface DatabaseCredentials {
  supabaseUrl: string
  anonKey: string
}

const getLanguage = (filePath: string): string => {
  if (!filePath) return "plaintext"
  const ext = filePath.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript"
    case "js":
    case "jsx":
      return "javascript"
    case "json":
      return "json"
    case "css":
      return "css"
    case "html":
      return "html"
    case "md":
      return "markdown"
    case "py":
      return "python"
    case "yml":
    case "yaml":
      return "yaml"
    case "sql":
      return "sql"
    case "env":
      return "properties"
    default:
      return "plaintext"
  }
}

const maskEnv = (content: string): string => {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed === "" || trimmed.startsWith("#")) return line
      const eqIdx = line.indexOf("=")
      if (eqIdx === -1) return line
      const key = line.substring(0, eqIdx + 1)
      const value = line.substring(eqIdx + 1)
      const maskedValue = "*".repeat(value.length)
      return key + maskedValue
    })
    .join("\n")
}

export function EditorPane({
  selectedFile,
  editedContent,
  setEditedContent,
  isEditorFocused,
  setIsEditorFocused,
  isDirty,
  handleSave,
  scrollRef,
  monacoRef,
  editorOptions,
  files,
  setSelectedFile,
  projectId,
  fetchFiles,
}: EditorPaneProps) {
  const { isSignedIn } = useUser()

  const language = React.useMemo(
    () => (selectedFile ? getLanguage(selectedFile.path) : "plaintext"),
    [selectedFile]
  )

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [currentRoot, setCurrentRoot] = React.useState<string>("")
  const [isApplying, setIsApplying] = React.useState(false)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  const sidebarRef = React.useRef<HTMLDivElement>(null)

  const [connectionStatus, setConnectionStatus] = React.useState<{
    connected: boolean
    connection: any
  } | null>(null)

  const [databaseCredentials, setDatabaseCredentials] =
    React.useState<DatabaseCredentials>({
      supabaseUrl: "",
      anonKey: "",
    })

  const [monacoInstance, setMonacoInstance] =
    React.useState<typeof import("monaco-editor") | null>(null)

  // 🔔 ShadCN Alert State
  const [alert, setAlert] = React.useState<{
    type: "success" | "error"
    title: string
    message: string
  } | null>(null)

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      import("monaco-editor").then((monaco) => {
        setMonacoInstance(monaco)
      })
    }
  }, [])

  const isSqlFile = selectedFile?.path?.toLowerCase().endsWith(".sql")
  const isEnvFile = React.useMemo(
    () => selectedFile?.path.toLowerCase().endsWith(".env") ?? false,
    [selectedFile]
  )

  const displayContent = React.useMemo(() => {
    if (!isEnvFile || isEditorFocused) return editedContent
    return maskEnv(editedContent)
  }, [isEnvFile, isEditorFocused, editedContent])

  // Fetch connection status
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch("/api/user/supabase-connection")
        const data = await response.json()
        setConnectionStatus(data)

        if (data.connected) {
          setDatabaseCredentials({
            supabaseUrl: data.connection.supabaseUrl,
            anonKey: data.connection.anonKey,
          })
        }
      } catch (error) {
        console.error("Failed to check connection:", error)
      }
    }
    checkConnection()
  }, [])

  const handleBreadcrumbClick = (partialPath: string) => {
    if (isSidebarOpen && currentRoot === partialPath) {
      setIsSidebarOpen(false)
    } else {
      setCurrentRoot(partialPath)
      setIsSidebarOpen(true)
    }
  }

  const handleFileSelect = (file: any) => {
    setSelectedFile(file)
    setIsSidebarOpen(false)
  }

  // 🚀 Push to Supabase (with UI Alert)
  const handleApplySql = async () => {
    if (!selectedFile || !isSqlFile) return

    setIsApplying(true)
    setAlert(null)

    try {
      const response = await fetch("/api/supabase/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: editedContent }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute SQL")
      }

      setAlert({
        type: "success",
        title: "Pushed Successfully",
        message: data.message || "Your SQL was pushed to Supabase.",
      })
    } catch (error: any) {
      setAlert({
        type: "error",
        title: "Push Failed",
        message: error.message || "Something went wrong.",
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleDisconnectSupabase = async () => {
    try {
      const response = await fetch("/api/user/supabase-connection", {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect")
      }

      setConnectionStatus({ connected: false, connection: null })
      setDatabaseCredentials({ supabaseUrl: "", anonKey: "" })

      setAlert({
        type: "success",
        title: "Disconnected",
        message: "Supabase connection removed.",
      })
    } catch (error: any) {
      setAlert({
        type: "error",
        title: "Error",
        message: error.message,
      })
    }
  }

  const handleConnect = (
    credentials: DatabaseCredentials,
    projectRef: string,
    projectName: string,
    accessToken: string
  ) => {
    setDatabaseCredentials(credentials)

    setConnectionStatus({
      connected: true,
      connection: {
        projectRef,
        projectName,
        supabaseUrl: credentials.supabaseUrl,
        anonKey: credentials.anonKey,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    })

    setAlert({
      type: "success",
      title: "Connected",
      message: "Supabase connected successfully.",
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {selectedFile ? (
        <>
          {/* Header */}
          <div className="px-3 py-2 bg-white border-b border-black/10 flex items-center justify-between">
            <div className="flex items-center text-xs text-black font-mono truncate">
              {selectedFile.path
                .split("/")
                .filter(Boolean)
                .map((part, index, arr) => {
                  const partialPath = arr.slice(0, index + 1).join("/")
                  return (
                    <React.Fragment key={partialPath}>
                      {index > 0 && (
                        <ChevronRight className="w-4 h-4 mx-0.5 text-gray-400" />
                      )}
                      <button
                        onClick={() => handleBreadcrumbClick(partialPath)}
                        className="focus:outline-none cursor-pointer hover:underline"
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  )
                })}
            </div>

            {isSqlFile && (
              <button
                onClick={handleApplySql}
                disabled={isApplying || !connectionStatus?.connected}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 rounded-2xl cursor-pointer",
                  (isApplying || !connectionStatus?.connected) &&
                    "opacity-70 cursor-not-allowed"
                )}
              >
                {isApplying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {isApplying ? "Pushing..." : "Push to Supabase"}
              </button>
            )}
          </div>

          {/* Editor */}
          <div ref={scrollRef} className="flex-1 overflow-hidden">
            <Editor
              key={selectedFile.path}
              height="100%"
              language={language}
              value={displayContent}
              onMount={(editor, monaco) => {
                monacoRef.current = editor
                editor.onDidFocusEditorWidget(() =>
                  setIsEditorFocused(true)
                )
                editor.onDidBlurEditorWidget(() =>
                  setIsEditorFocused(false)
                )
              }}
              onChange={(value) => setEditedContent(value || "")}
              options={{
                ...editorOptions,
                minimap: { enabled: false },
                automaticLayout: true,
              }}
            />
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Select a file to view
        </div>
      )}

      {/* 🔔 ShadCN Alert (Bottom Right, 3px from bottom) */}
{alert && (
  <div className="fixed bottom-2 right-0 w-[10%] z-50 px-4 pb-[3px]">
    <Alert className="w-full flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <AlertTitle className="font-semibold leading-tight">
          {alert.title}
        </AlertTitle>
        <AlertDescription className="leading-snug break-words">
          {alert.message}
        </AlertDescription>
      </div>

      <button
        onClick={() => setAlert(null)}
        className="ml-3 mt-1 hover:opacity-70 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </Alert>
  </div>
)}
          {isSidebarOpen && (
            <div ref={sidebarRef} className="bg-white shadow-xl absolute ml-3 mt-5 rounded-lg border z-10 w-64">
              <FileSidebar
                files={files}
                onFileSelect={handleFileSelect}
                selectedPath={selectedFile?.path ?? null}
                projectId={projectId}
                onFilesChange={fetchFiles}
                currentRoot={currentRoot}
              />
            </div>
          )}

      <SupabaseConnectModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        credentialsSaved={!!connectionStatus?.connected}
        databaseCredentials={databaseCredentials}
        selectedProjectRef={connectionStatus?.connection?.projectRef || ""}
        projects={[
          {
            ref: connectionStatus?.connection?.projectRef || "",
            name: connectionStatus?.connection?.projectName || "",
          },
        ]}
        onDisconnect={handleDisconnectSupabase}
        onConnect={handleConnect}
        isAuthenticated={!!isSignedIn}
      />
    </div>
  )
}