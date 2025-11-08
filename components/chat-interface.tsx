"use client"

import { useState, useEffect, useRef } from "react"
import { MessageList } from "@/components/message/message-list"
import { ChatInput } from "@/components/workbench/chat-input"
import { CodePreview } from "@/components/workbench/code-preview"
import type { Project, Message } from "@/config/schema"

interface ChatInterfaceProps {
  project: Project
  initialMessages: Message[]
}

export function ChatInterface({ project, initialMessages }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const validMessages = initialMessages.filter((msg): msg is Message => {
      if (!msg || typeof msg !== "object") return false
      if (msg.id === undefined || msg.id === null) {
        return false
      }
      return true
    })
    if (validMessages.length !== initialMessages.length) {
      setMessages(validMessages)
    }
  }, [initialMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)
    }
  }

  const handleNewMessage = (message: Message | null) => {
    if (!message || !message.id) {
      return
    }

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

    setTimeout(() => {
      scrollToBottom()
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <main className="flex-1 flex overflow-hidden">
      <div className={`relative flex flex-col w-full max-w-2xl bg-[#161616]`} style={{ height: "100vh" }}>
        <div className="p-4">
          <h1 className="text-2xl font-sans font-light text-white">{project.title}</h1>
        </div>

        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-2 relative chat-messages-scroll"
        >
          <MessageList messages={messages} />
          <div ref={messagesEndRef} />
        </div>

        <div
          className=" left-0 w-full px-4 bg-[#161616] mb-3"
          style={{
            bottom: "10px",
          }}
        >
          <ChatInput
            isAuthenticated={true}
            projectId={project.id}
            onNewMessage={handleNewMessage}
            initialModel={project.selectedModel || "gemini"}
          />
        </div>
      </div>

      <div className="flex-1">
        <CodePreview projectId={project.id} />
      </div>
    </main>
  )
}
