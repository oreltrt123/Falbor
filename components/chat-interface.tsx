"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { MessageList } from "@/components/message/message-list"
import { ChatInput } from "@/components/workbench/chat-input"
import { CodePreview } from "@/components/workbench/code-preview"
import type { Project, Message as SchemaMessage } from "@/config/schema"
import { Navbar } from "@/components/chat/navbar"

interface StrictMessage extends Omit<SchemaMessage, "role"> {
  role: "user" | "assistant"
}

interface ChatInterfaceProps {
  project: Project
  initialMessages: SchemaMessage[]
}

export function ChatInterface({ project, initialMessages }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<StrictMessage[]>([])
  const [windowWidth, setWindowWidth] = useState(0)
  const [isResizingState, setIsResizingState] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const hasAutoTriggered = useRef(false)
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
    if (!hasAutoTriggered.current && messages.length > 0 && !isStreaming) {
      const lastMessage = messages[messages.length - 1]
      const assistantMessages = messages.filter((m) => m.role === "assistant")
      if (lastMessage.role === "user" && assistantMessages.length === 0) {
        hasAutoTriggered.current = true
        handleAutoGenerate(lastMessage.content)
      }
    }
  }, [])

  const handleAutoGenerate = async (userContent: string) => {
    setIsStreaming(true)

    // Add temp assistant message to UI immediately
    const tempAssistant: StrictMessage = {
      id: `temp-auto-${Date.now()}`,
      projectId: project.id,
      role: "assistant",
      content: "",
      hasArtifact: false,
      createdAt: new Date(),
      thinking: null,
      searchQueries: null,
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
              }
            } catch (e) {
              console.error("[v0] JSON parse error:", e)
            }
          }
        }
      }
    } catch (err) {
      console.error("[Auto-Generate] Error:", err)
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")))
    } finally {
      setIsStreaming(false)
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

    setMessages((prev) => {
      const validPrev = prev.filter((m) => m && m.id)

      if (safeMessage.id.startsWith("temp-")) {
        const existingIndex = validPrev.findIndex((m) => m.id === safeMessage.id)
        if (existingIndex !== -1) {
          // Update existing temp message with new content
          const newMessages = [...validPrev]
          newMessages[existingIndex] = safeMessage
          return newMessages
        }
        // Add new temp message if not found
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

  // Resizing handlers
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Chat Panel */}
        <div
          className={`flex flex-col bg-[#161616] overflow-hidden ${isResizingState ? "transition-none" : "transition-all duration-200"}`}
          style={{ width: leftWidth }}
        >
          <div
            ref={messagesContainerRef}
            className={`flex-1 overflow-y-auto overflow-x-hidden chat-messages-scroll py-4 mt-14 ${isNarrow ? "px-4" : "px-0"} ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
          >
            <div
              className={`${isNarrow ? "" : "max-w-2xl mx-auto px-4"} ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
            >
              <MessageList
                messages={messages.map((msg) => ({
                  ...msg,
                  createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
                }))}
              />
            </div>
            <div ref={messagesEndRef} />
          </div>

          <div
            className={`flex-none pb-4 ${isNarrow ? "px-4" : "px-0"} ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
          >
            <div
              className={`${isNarrow ? "" : "max-w-2xl mx-auto px-4"} ${isResizingState ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
            >
              <ChatInput
                isAuthenticated={true}
                projectId={project.id}
                initialModel={project.selectedModel || "gemini"}
                onNewMessage={handleNewMessage}
              />
            </div>
          </div>
        </div>

        {/* Vertical Resizable Divider */}
        <div onMouseDown={handleMouseDown} className="w-1 cursor-col-resize hover:bg-[#1b1b1b] py-4 mt-14" />

        {/* Right Code Panel */}
        <div className="flex-1 px-2  py-4 mt-10 overflow-hidden">
          <CodePreview projectId={project.id} />
        </div>
      </div>
    </div>
  )
}