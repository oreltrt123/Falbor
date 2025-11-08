"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import type { Message } from "@/config/schema"
import Link from "next/link"

interface ChatInputProps {
  isAuthenticated: boolean
  projectId?: string
  onNewMessage?: (message: Message) => void
  placeholder?: string
  initialModel?: string
}

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
}

export function ChatInput({
  isAuthenticated,
  projectId,
  onNewMessage,
  placeholder = "What would you like to build today?",
  initialModel = "gemini",
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedModel, setSelectedModel] = useState<"gemini" | "claude" | "gpt">( //"v0"
    initialModel as "gemini" | "claude" | "gpt", //"v0"
  )
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { user, isLoaded } = useUser()

  const modelOptions = {
    gemini: { label: "Gemini 2.0", icon: "/icons/gemini.png", color: "text-blue-400" },
    claude: { label: "Claude 3.5", icon: "/icons/claude.png", color: "text-purple-400" },
    gpt: { label: "GPT-4", icon: "/icons/openai.png", color: "text-green-400" },
    // v0: { label: "v0", icon: "⚡", color: "text-orange-400" },
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchCredits = async () => {
    if (!user?.id || !isLoaded) return
    try {
      const res = await fetch("/api/user/credits")
      if (res.ok) {
        const data: CreditsData = await res.json()
        setCreditsData(data)
        setTimeLeft(data.secondsUntilNextRegen)
      } else {
        console.error(`Failed to fetch credits: ${res.status} ${res.statusText}`)
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err)
    }
  }

  useEffect(() => {
    fetchCredits()

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchCredits()
          return 60
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user?.id, isLoaded])

  const refetchCredits = async () => {
    if (!user?.id) return
    await fetchCredits()
  }

  const getBorderClass = () => {
    if (isFocused || message.trim()) {
      return "border border-[#3b3b3fbe]"
    }
    return "border border-[#272727]"
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setSelectedImage({ data: base64.split(",")[1], mimeType: file.type })
      setImagePreview(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleImprovePrompt = async () => {
    if (!message.trim() || !projectId || isImproving) return
    setIsImproving(true)

    let liveText = ""

    try {
      const res = await fetch("/api/chat/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: message }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error("No stream")

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
                liveText += data.text
                setMessage(liveText)
              }
              if (data.done) {
                setMessage(data.improvedPrompt)
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error("Prompt improvement failed:", err)
    } finally {
      setIsImproving(false)
    }
  }

  useEffect(() => {
    if (projectId && selectedModel !== initialModel) {
      const saveModel = async () => {
        try {
          await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedModel }),
          })
        } catch (error) {
          console.error("[v0] Failed to save model selection:", error)
        }
      }
      saveModel()
    }
  }, [selectedModel, projectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    if (isLoaded && creditsData && creditsData.credits <= 0) {
      alert("Insufficient credits. Please wait for regeneration.")
      return
    }

    setIsLoading(true)
    const userMessage = message

    try {
      const deductRes = await fetch("/api/user/credits", {
        method: "POST",
      })

      if (!deductRes.ok) {
        const errData = await deductRes.json().catch(() => ({}))
        if (deductRes.status === 401) {
          alert("Please sign in to continue.")
          return
        }
        if (deductRes.status === 402) {
          alert("Insufficient credits. Please wait for regeneration.")
          return
        }
        alert(errData.error || "Failed to process your request. Please try again.")
        return
      }

      await refetchCredits()

      setMessage("")
      setSelectedImage(null)
      setImagePreview(null)

      if (projectId && onNewMessage) {
        const tempUser: Message = {
          id: `temp-${Date.now()}`,
          projectId,
          role: "user",
          content: userMessage,
          hasArtifact: false,
          createdAt: new Date().toISOString(),
        }
        onNewMessage(tempUser)

        const tempAssistant: Message = {
          id: `temp-assistant-${Date.now()}`,
          projectId,
          role: "assistant",
          content: "",
          hasArtifact: false,
          createdAt: new Date().toISOString(),
        }
        onNewMessage(tempAssistant)

        console.log("[v0] Sending message to API with model:", selectedModel)

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              message: userMessage,
              imageData: selectedImage,
              model: selectedModel,
            }),
          })

          if (!res.ok) {
            throw new Error(`API returned ${res.status}: ${res.statusText}`)
          }

          const reader = res.body?.getReader()
          if (!reader) {
            throw new Error("No response body reader available")
          }

          const decoder = new TextDecoder()
          let accumulated = ""
          let streamError = false

          while (true) {
            try {
              const { done, value } = await reader.read()
              if (done) {
                console.log("[v0] Stream completed")
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split("\n")

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6))

                    if (data.error) {
                      console.error("[v0] Stream error:", data.error)
                      streamError = true
                      alert(`Error: ${data.error}`)
                      break
                    }

                    if (data.text) {
                      accumulated += data.text

                      // Strip code blocks from message display
                      const strippedContent = accumulated.replace(/```(\w+)\s+file="([^"]+)"\n[\s\S]*?```/g, "").trim()

                      onNewMessage({ ...tempAssistant, content: strippedContent })
                    }

                    if (data.done) {
                      console.log("[v0] Received done signal, message ID:", data.messageId)

                      // Final message without code blocks
                      const finalContent = accumulated.replace(/```(\w+)\s+file="([^"]+)"\n[\s\S]*?```/g, "").trim()

                      onNewMessage({
                        id: data.messageId || `final-${Date.now()}`,
                        projectId,
                        role: "assistant",
                        content: finalContent,
                        hasArtifact: data.hasArtifact ?? false,
                        createdAt: new Date().toISOString(),
                      })
                    }
                  } catch (parseError) {
                    console.error("[v0] JSON parse error:", parseError, "Line:", line)
                  }
                }
              }

              if (streamError) break
            } catch (readError) {
              console.error("[v0] Stream read error:", readError)
              break
            }
          }

          console.log("[v0] Refreshing page...")
          router.refresh()
        } catch (fetchError) {
          console.error("[v0] Fetch error:", fetchError)
          alert(`Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
        }
      } else if (projectId) {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            message: userMessage,
            imageData: selectedImage,
            model: selectedModel,
          }),
        })
        router.refresh()
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            model: selectedModel,
          }),
        })
        const { projectId: newId } = await res.json()
        router.push(`/chat/${newId}`)
      }
    } catch (err) {
      console.error("[v0] Submit error:", err)
      alert("An error occurred while sending your message. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  if (!isLoaded || !isAuthenticated) {
    return (
      <div className="space-y-2">
        <div className="relative bg-[#212122] border border-[#3b3b3f77] rounded-md overflow-hidden">
          <textarea
            placeholder={placeholder}
            className="w-full min-h-[120px] max-h-[200px] resize-none bg-transparent text-white placeholder:text-muted-foreground px-3 pt-3 pb-12 text-base outline-none overflow-y-auto field-sizing-content disabled:cursor-not-allowed disabled:opacity-50"
            disabled
          />
          <div className="absolute top-0 right-0 flex items-center justify-between px-3 py-2 bg-[#212122]">
            <div className="flex gap-1.5">
              <Link href={"/sign-in"}>
                <button className="text-sm font-medium hover:underline w-[70px] bg-[#0099FF] p-1 rounded-md text-white">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="">
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview || "/placeholder.svg"}
            alt="Upload preview"
            className="h-20 rounded border border-border"
          />
          <button
            type="button"
            onClick={() => {
              setImagePreview(null)
              setSelectedImage(null)
            }}
            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
          >
            X
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`relative bg-[#1b1b1b] ${getBorderClass()} rounded-md overflow-hidden`}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full min-h-[120px] max-h-[200px] resize-none bg-transparent text-white placeholder:text-muted-foreground
                     px-3 pt-3 pb-12 text-base outline-none overflow-y-auto field-sizing-content
                     disabled:cursor-not-allowed disabled:opacity-50"
          style={{ scrollbarWidth: "thin" }}
          disabled={isLoading}
        />

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-[#1b1b1b]">
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-[#313135] rounded transition-colors"
              title="Upload image"
              disabled={isLoading}
            >
              <img width={20} height={20} src="/upload2.png" alt="" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

            <button
              type="button"
              onClick={handleImprovePrompt}
              disabled={isImproving || !message.trim() || !projectId || isLoading}
              className="p-2 hover:bg-[#313135] rounded transition-colors disabled:opacity-50"
              title="Improve prompt"
            >
              <img width={20} height={20} src="/enhance_prompt.png" alt="" />
              {isImproving && <span className="ml-1 animate-pulse">…</span>}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#313135] rounded transition-colors text-sm"
                disabled={isLoading}
              >
                <img
                  src={modelOptions[selectedModel].icon}
                  alt=""
                  className={`w-4 h-4 ${modelOptions[selectedModel].color}`}
                />
                <span className="text-white/75">{modelOptions[selectedModel].label}</span>
                <ChevronDown className="w-3 h-3 text-white/50" />
              </button>

              {showModelDropdown && (
                <div className="absolute left-0 bottom-[-7px] bg-[#181818] border border-[#333333c9] rounded-md shadow-lg overflow-hidden p-1 z-50 min-w-[200px]">
                  {Object.entries(modelOptions).map(([key, { label, icon, color }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedModel(key as any)
                        setShowModelDropdown(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[#3333338e] transition-colors ${
                        selectedModel === key ? "bg-[#3333337a]" : ""
                      }`}
                    >
                      <img src={icon} alt="" className={`w-4 h-4 ${color}`} />
                      <span className="text-white/75">{label}</span>
                      {selectedModel === key && <span className="ml-auto text-green-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 p-2 bg-[#2f2f30]"
            disabled={!message.trim() || isLoading || !isAuthenticated}
          >
            <img width={20} height={20} src="/mouse-cursor.png" alt="" />
          </Button>
        </div>
      </form>

      {creditsData && (
        <div className="bg-[#272727] p-2 mt-[-7px] z-[-10px] rounded-b-lg flex items-center justify-between text-sm text-muted-foreground px-1">
          <div className="flex items-center gap-2 ml-2 mt-1">
            <span className="text-[#ffffffd0] hover:text-[#ffffffb6]">{creditsData.credits} credits remaining</span>
          </div>
          <span className="mr-2 mt-1 text-[#ffffffd0] hover:text-[#ffffffb6]">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  )
}