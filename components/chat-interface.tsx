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
            className={`flex-1 overflow-y-auto py-2 overflow-x-hidden chat-messages-scroll ${isNarrow ? "px-4" : "px-0"} ${isResizingState ? 'transition-none' : 'transition-all duration-300 ease-in-out'}`}
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
          className="w-1 cursor-col-resize hover:bg-[#1b1b1b]"
        />

        {/* Right Code Panel */}
        <div className="flex-1 px-2  py-4 mt-14 overflow-hidden">
          <CodePreview projectId={project.id} />
        </div>
      </div>
    </div>
  )
}