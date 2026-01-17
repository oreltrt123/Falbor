"use client"
import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { MessageList } from "@/components/message/message-list"
import { ChatInput } from "@/components/layout/chat"
import { CodePreview } from "@/components/workbench/code-preview"
import type { Project, Message as SchemaMessage } from "@/config/schema"
import { Navbar } from "./chat/navbar"
import { useAuth } from "@clerk/nextjs"
import { usePathname, useSearchParams, useRouter } from "next/navigation"

interface StrictMessage extends Omit<SchemaMessage, "role"> {
  role: "user" | "assistant"
}
interface ChatInterfaceProps {
  project: Project
  initialMessages: SchemaMessage[]
  initialUserMessage?: string
}
function isCodeGenerationRequest(content: string): boolean {
  const lowerContent = content.toLowerCase()
  const codeKeywords = [
    "build",
    "create",
    "make",
    "develop",
    "generate",
    "code",
    "app",
    "website",
    "component",
    "page",
    "design",
    "implement",
    "add",
    "update",
    "fix",
    "change",
    "modify",
    "refactor",
    "style",
    "layout",
    "form",
    "button",
    "navbar",
    "footer",
  ]
  return codeKeywords.some((keyword) => lowerContent.includes(keyword))
}
export function ChatInterface({ project, initialMessages, initialUserMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<StrictMessage[]>([])
  const [windowWidth, setWindowWidth] = useState(0)
  const [isResizingState, setIsResizingState] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCodeGenerating, setIsCodeGenerating] = useState(false)
  const [previewError, setPreviewError] = useState<{
    message: string
    file?: string
    line?: string
  } | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [hasProjectFiles, setHasProjectFiles] = useState(false)
  const hasAutoTriggered = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState(500)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const { getToken } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isNarrow = isPreviewOpen && leftWidth < windowWidth * 0.4
  useEffect(() => {
    async function checkProjectFiles() {
      try {
        const res = await fetch(`/api/projects/${project.id}/files`)
        if (res.ok) {
          const data = await res.json()
          const hasFiles = data.files && data.files.length > 0
          setHasProjectFiles(hasFiles)
          if (hasFiles) {
            setIsPreviewOpen(true)
          }
        }
      } catch (err) {
        console.error("[v0] Failed to check project files:", err)
      }
    }
    if (project.id) {
      checkProjectFiles()
    }
  }, [project.id])
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])
  useEffect(() => {
    const validMessages = initialMessages.filter((msg): msg is SchemaMessage & { role: "user" | "assistant" } => {
      if (!msg || typeof msg !== "object") return false
      if (msg.id === undefined || msg.id === null) return false
      return msg.role === "user" || msg.role === "assistant"
    })
    const strictMessages: StrictMessage[] = validMessages.map((msg) => ({
      ...msg,
      role: msg.role as "user" | "assistant",
    }))
    setMessages(strictMessages)
  }, [initialMessages])
  useEffect(() => {
    if (initialUserMessage && !hasAutoTriggered.current && project.id) {
      const assistantMessages = messages.filter((m) => m.role === "assistant")
      if (assistantMessages.length > 0) {
        return
      }
      hasAutoTriggered.current = true
      const existingUserMessage = messages.find((m) => m.role === "user" && m.content === initialUserMessage)
      if (existingUserMessage) {
        if (isCodeGenerationRequest(initialUserMessage)) {
          setIsPreviewOpen(true)
        }
        handleAutoGenerate(initialUserMessage)
      } else {
        const userMessage: StrictMessage = {
          id: `initial-user-${Date.now()}`,
          projectId: project.id,
          role: "user",
          content: initialUserMessage,
          hasArtifact: false,
          createdAt: new Date(),
          thinking: null,
          searchQueries: null,
          isAutomated: false,
        }
        setMessages([userMessage])
        if (isCodeGenerationRequest(initialUserMessage)) {
          setIsPreviewOpen(true)
        }
        handleAutoGenerate(initialUserMessage)
      }
    }
  }, [initialUserMessage, project.id, messages])
  useEffect(() => {
    if (!hasAutoTriggered.current && messages.length > 0 && !isStreaming) {
      const lastMessage = messages[messages.length - 1]
      const assistantMessages = messages.filter((m) => m.role === "assistant")
      if (lastMessage.role === "user" && assistantMessages.length === 0) {
        hasAutoTriggered.current = true
        if (isCodeGenerationRequest(lastMessage.content)) {
          setIsPreviewOpen(true)
        }
        handleAutoGenerate(lastMessage.content)
      }
    }
  }, [messages, isStreaming])
  useEffect(() => {
    if (project.id) {
      const savedError = localStorage.getItem(`preview-error-${project.id}`)
      if (savedError) {
        try {
          setPreviewError(JSON.parse(savedError))
        } catch (e) {
          console.error("[v0] Failed to parse saved error:", e)
        }
      }
    }
  }, [project.id])
  useEffect(() => {
    if (project.id) {
      if (previewError) {
        localStorage.setItem(`preview-error-${project.id}`, JSON.stringify(previewError))
      } else {
        localStorage.removeItem(`preview-error-${project.id}`)
      }
    }
  }, [previewError, project.id])
  const handleAutoGenerate = async (userContent: string) => {
    setIsStreaming(true)
    if (isCodeGenerationRequest(userContent)) {
      setIsCodeGenerating(true)
    }
    const tempAssistant: StrictMessage = {
      id: `temp-auto-${Date.now()}`,
      projectId: project.id,
      role: "assistant",
      content: "",
      hasArtifact: false,
      createdAt: new Date(),
      thinking: null,
      searchQueries: null,
      isAutomated: true,
    }
    setMessages((prev) => [...prev, tempAssistant])
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          message: userContent,
          model: project.selectedModel || "gemini",
        }),
      })
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")
      const decoder = new TextDecoder()
      let accumulated = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter(Boolean)
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                accumulated += data.text
                setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: accumulated } : m)))
              }
              if (data.done) {
                setMessages((prev) => {
                  const lastIndex = prev.length - 1
                  const lastMsg = prev[lastIndex]
                  return [
                    ...prev.slice(0, lastIndex),
                    {
                      ...lastMsg,
                      id: data.messageId || `final-${Date.now()}`,
                      content: accumulated,
                      hasArtifact: data.hasArtifact ?? false,
                    },
                  ]
                })
                if (data.hasArtifact) {
                  setHasProjectFiles(true)
                }
              }
            } catch (e) {
              console.error("[v0] JSON parse error:", e)
            }
          }
        }
      }
    } catch (err) {
      console.error("[Auto-Generate] Error:", err)
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")))
    } finally {
      setIsStreaming(false)
      setIsCodeGenerating(false)
      // Remove prompt query param if exists
      if (searchParams.has("prompt")) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("prompt")
        router.replace(`${pathname}${params.toString() ? "?" + params.toString() : ""}`, { scroll: false })
      }
    }
  }
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  const handleNewMessage = (message: SchemaMessage | null) => {
    if (!message || !message.id || (message.role !== "user" && message.role !== "assistant")) return
    const safeMessage: StrictMessage = {
      ...message,
      role: message.role as "user" | "assistant",
    }
    if (safeMessage.role === "user" && isCodeGenerationRequest(safeMessage.content)) {
      setIsPreviewOpen(true)
      setIsCodeGenerating(true)
    }
    setMessages((prev) => {
      const validPrev = prev.filter((m) => m && m.id)
      if (safeMessage.id.startsWith("temp-")) {
        const existingIndex = validPrev.findIndex((m) => m.id === safeMessage.id)
        if (existingIndex !== -1) {
          const newMessages = [...validPrev]
          newMessages[existingIndex] = safeMessage
          return newMessages
        }
        return [...validPrev, safeMessage]
      }
      const filteredPrev = validPrev.filter((m) => !m.id.startsWith("temp-assistant-"))
      const exists = filteredPrev.some((m) => m.id === safeMessage.id)
      if (exists) {
        return filteredPrev.map((m) => (m.id === safeMessage.id ? safeMessage : m))
      }
      return [...filteredPrev, safeMessage]
    })
    setTimeout(() => scrollToBottom(), 0)
  }
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  const handleDismissError = () => {
    setPreviewError(null)
  }
  const handlePreviewError = (error: { message: string; file?: string; line?: string }) => {
    setPreviewError(error)
  }
  const handlePreviewClose = () => {
    if (!hasProjectFiles) {
      setIsPreviewOpen(false)
    }
  }
  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return
    const newWidth = startWidth.current + (e.clientX - startX.current)
    setLeftWidth(Math.max(200, Math.min(newWidth, window.innerWidth - 200)))
  }
  const handleMouseUp = () => {
    isResizing.current = false
    setIsResizingState(false)
    document.body.style.userSelect = "auto"
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
  }
  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true
    setIsResizingState(true)
    startX.current = e.clientX
    startWidth.current = leftWidth
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }
  const handleDownload = useCallback(async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    try {
      const token = await getToken()
      const res = await fetch(`/api/projects/${project.id}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const { files } = await res.json()
      files.forEach((file: any) => zip.file(file.path, file.content))
      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `${project.id}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("[ChatInterface] Download error:", e)
    }
  }, [project.id, getToken])
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar projectId={project.id} handleDownload={handleDownload} />
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`flex flex-col overflow-hidden ${isPreviewOpen ? "" : "flex-1"}`} //${isResizingState ? "transition-none" : "transition-all duration-200"}
          style={{ width: isPreviewOpen ? leftWidth : "100%" }}
        >
          <div
            ref={messagesContainerRef}
            className={`flex-1 overflow-y-auto overflow-x-hidden chat-messages-scroll py-4 mt-14 ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
          >
            <div
              className={`${isPreviewOpen ? (isNarrow ? "px-4" : "max-w-2xl mx-auto px-4") : "max-w-2xl mx-auto px-4"} ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
            >
              <MessageList
                messages={messages.map((msg) => ({
                  ...msg,
                  createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
                }))}
                projectId={project.id}
              />
            </div>
            <div ref={messagesEndRef} />
          </div>
          <div
            className={`flex-none pb-4 ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
          >
            <div
              className={`${isPreviewOpen ? (isNarrow ? "px-4" : "max-w-2xl mx-auto px-4") : "max-w-2xl mx-auto px-4"} ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
            >
              <ChatInput
                isAuthenticated={true}
                projectId={project.id}
                initialModel={project.selectedModel || "gemini"}
                onNewMessage={handleNewMessage}
                onDismissError={handleDismissError}
              />
            </div>
          </div>
        </div>
        {isPreviewOpen && (
          <div onMouseDown={handleMouseDown} className="w-1 cursor-col-resize hover:bg-[#e7e7e7] py-4 mt-14" />
        )}
        {isPreviewOpen && (
          <div className="flex-1 px-2 py-4 mt-10 overflow-hidden">
            <CodePreview
              projectId={project.id}
              isCodeGenerating={isCodeGenerating}
              onError={handlePreviewError}
              isOpen={isPreviewOpen}
              onClose={handlePreviewClose}
            />
          </div>
        )}
      </div>
    </div>
  )
}