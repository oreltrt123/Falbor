"use client"

import { useState, useEffect, useRef } from "react"
import { MessageList } from "@/components/message/message-list"
import { ChatInput } from "@/components/workbench/chat-input"
import { CodePreview } from "@/components/workbench/code-preview"
import type { Project, Message } from "@/config/schema"
import { Navbar } from "@/components/chat/navbar"

interface ChatInterfaceProps {
  project: Project
  initialMessages: Message[]
}

export function ChatInterface({ project, initialMessages }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [windowWidth, setWindowWidth] = useState(0)
  const [isResizingState, setIsResizingState] = useState(false)
  const [isAutoSending, setIsAutoSending] = useState(false)
  const hasAutoTriggered = useRef(false) // NEW: Ref to ensure single trigger
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Width of the left panel (chat)
  const [leftWidth, setLeftWidth] = useState(500)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const isNarrow = leftWidth < windowWidth * 0.4

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const validMessages = initialMessages.filter((msg): msg is Message => {
      if (!msg || typeof msg !== "object") return false
      if (msg.id === undefined || msg.id === null) return false
      return true
    })
    if (validMessages.length !== initialMessages.length) {
      setMessages(validMessages)
    }
  }, [initialMessages])

  // UPDATED: Auto-trigger AI response ONLY on mount if last message is unpaired user message
  useEffect(() => {
    // Run only once on mount
    if (!hasAutoTriggered.current && messages.length > 0 && !isAutoSending) {
      const lastMessage = messages[messages.length - 1]
      const assistantMessages = messages.filter(m => m.role === "assistant")
      if (lastMessage.role === "user" && assistantMessages.length === 0) { // Only user message(s), no assistant yet
        hasAutoTriggered.current = true
        setIsAutoSending(true)
        // Trigger /api/chat to generate response based on history
        handleAutoGenerate(lastMessage.content)
      }
    }
  }, []) // Empty deps: Run only once after mount

  const handleAutoGenerate = async (userContent: string) => {
    // Add temp assistant message to UI immediately
    const tempAssistant: Message = {
      id: `temp-auto-${Date.now()}`,
      projectId: project.id,
      role: "assistant",
      content: "",
      hasArtifact: false,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempAssistant])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          message: userContent, // Re-send the user's prompt to generate response based on history
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
                // Strip tags for display
                const stripped = accumulated
                  .replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, "")
                  .replace(/<search>[\s\S]*?<\/search>/gi, "")
                  .replace(/```(\w+)\s+file="([^"]+)"\n[\s\S]*?```/g, "")
                  .trim()
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1].content = stripped
                  return updated
                })
              }
              if (data.done) {
                // Final update with full data
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    id: data.messageId || `final-${Date.now()}`,
                    content: accumulated
                      .replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, "")
                      .replace(/<search>[\s\S]*?<\/search>/gi, "")
                      .replace(/```(\w+)\s+file="([^"]+)"\n[\s\S]*?```/g, "")
                      .trim(),
                    hasArtifact: data.hasArtifact ?? false,
                  }
                  return updated
                })
                // Refresh page to load full DB state (artifacts, etc.)
                window.location.reload() // Or use router.refresh() if using app dir
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error("[Auto-Generate] Error:", err)
      setMessages(prev => prev.slice(0, -1)) // Remove temp
    } finally {
      setIsAutoSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleNewMessage = (message: Message | null) => {
    if (!message || !message.id) return

    setMessages((prev) => {
      const validPrev = prev.filter((m) => m && m.id)

      if (message.id.startsWith("temp-")) {
        const existingIndex = validPrev.findIndex((m) => m.id === message.id)
        if (existingIndex !== -1) {
          const newMessages = [...validPrev]
          newMessages[existingIndex] = message
          return newMessages
        }
        return [...validPrev, message]
      }

      const withoutTemp = validPrev.filter((m) => !m.id.startsWith("temp-assistant"))
      return [...withoutTemp, message]
    })

    setTimeout(() => scrollToBottom(), 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

// Resizing handlers
const handleMouseMove = (e: MouseEvent) => {
  if (!isResizing.current) return
  const newWidth = startWidth.current + (e.clientX - startX.current)
  setLeftWidth(Math.max(200, Math.min(newWidth, window.innerWidth - 200))) // min/max widths
}

const handleMouseUp = () => {
  isResizing.current = false
  setIsResizingState(false)
  // re-enable text selection
  document.body.style.userSelect = "auto"
  document.removeEventListener("mousemove", handleMouseMove)
  document.removeEventListener("mouseup", handleMouseUp)
}

const handleMouseDown = (e: React.MouseEvent) => {
  isResizing.current = true
  setIsResizingState(true)
  startX.current = e.clientX
  startWidth.current = leftWidth
  // disable text selection while dragging
  document.body.style.userSelect = "none"
  document.addEventListener("mousemove", handleMouseMove)
  document.addEventListener("mouseup", handleMouseUp)
}


  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Chat Panel */}
        <div
          className={`flex flex-col bg-[#161616] overflow-hidden ${isResizingState ? 'transition-none' : 'transition-all duration-200'}`}
          style={{ width: leftWidth }}
        >
          <div
            ref={messagesContainerRef}
            className={`flex-1 overflow-y-auto overflow-x-hidden chat-messages-scroll py-4 mt-14 ${isNarrow ? "px-4" : "px-0"} ${isResizingState ? 'transition-none' : 'transition-all duration-300 ease-in-out'}`}
          >
            <div className={`${isNarrow ? "" : "max-w-2xl mx-auto px-4"} ${isResizingState ? 'transition-none' : 'transition-all duration-300 ease-in-out'}`}>
              <MessageList messages={messages} />
            </div>
            <div ref={messagesEndRef} />
          </div>

          <div className={`flex-none pb-4 ${isNarrow ? "px-4" : "px-0"} ${isResizingState ? 'transition-none' : 'transition-all duration-300 ease-in-out'}`}>
            <div className={`${isNarrow ? "" : "max-w-2xl mx-auto px-4"} ${isResizingState ? 'transition-none' : 'transition-all duration-300 ease-in-out'}`}>
              <ChatInput
                isAuthenticated={true}
                projectId={project.id}
                onNewMessage={handleNewMessage}
                initialModel={project.selectedModel || "gemini"}
              />
            </div>
          </div>
        </div>

        {/* Vertical Resizable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 cursor-col-resize hover:bg-[#1b1b1b] py-4 mt-14"
        />

        {/* Right Code Panel */}
        <div className="flex-1 px-2  py-4 mt-10 overflow-hidden">
          <CodePreview projectId={project.id} />
        </div>
      </div>
    </div>
  )
}