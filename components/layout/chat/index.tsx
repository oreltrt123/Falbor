"use client"

import type React from "react"
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { ChevronDown, Loader } from "lucide-react"
import type { Message } from "@/config/schema"
import Link from "next/link"
import { PricingModal } from "@/components/models/PricingModal" // New import

interface ChatInputProps {
  isAuthenticated: boolean
  projectId?: string
  onNewMessage?: (message: Message) => void
  placeholder?: string
  initialModel?: string
  connected?: boolean
  onCloseIdeas?: () => void
  isAutomated?: boolean // New: For cron auto-chats; skips credits
}

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
  isPremium: boolean // Updated: Include premium status
}

export interface ChatInputRef {
  insertPrompt: (prompt: string) => void
}

interface ModelOption {
  label: string
  icon: string
  color: string
  soon?: string
}

export type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss" // | "grok" | "v0" 

const ChatInputImpl = forwardRef<ChatInputRef, ChatInputProps>(function ChatInputImpl(
  {
    isAuthenticated,
    projectId,
    onNewMessage,
    placeholder = "What would you like to build today?",
    initialModel = "gemini",
    connected = false,
    onCloseIdeas,
    isAutomated = false, // New
  },
  ref,
) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedModel, setSelectedModel] = useState<ModelType>(initialModel as ModelType)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [isDiscussMode, setIsDiscussMode] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false) // New: Modal state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { user, isLoaded } = useUser()

  const modelOptions: Record<ModelType, ModelOption> = {
    gemini: { label: "Gemini 2.0", icon: "/icons/gemini.png", color: "text-blue-400" },
    claude: { label: "Claude Sonnet 4.5", icon: "/icons/claude.png", color: "text-purple-400" },
    gpt: { label: "GPT-5", icon: "/icons/openai.png", color: "text-green-400" },
    // v0: { label: "v0", icon: "/icons/logoV0.png", color: "text-orange-400" },
    // grok: { label: "Grok-3", icon: "/icons/grok.png", color: "text-red-400", soon: "SOON" },
    deepseek: { label: "Deepseek R3", icon: "/icons/deepseek.png", color: "text-teal-400" },
    gptoss: { label: "GPT-OSS 20B", icon: "/icons/openai.png", color: "text-green-400" },
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
    if (projectId && selectedModel !== initialModel && !modelOptions[selectedModel]?.soon) {
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
  }, [selectedModel, projectId, initialModel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    const currentOption = modelOptions[selectedModel]
    if (currentOption?.soon) {
      alert(`${currentOption.label} is coming soon! Please select another model.`)
      return
    }

    // if (isDiscussMode && selectedModel === "v0") {
    //   alert("Discuss mode is not supported with v0. Please switch to another model.")
    //   return
    // }

    if (isLoaded && creditsData && !creditsData.isPremium && creditsData.credits <= 0 && !isAutomated) { // Updated: Only block non-premium
      alert("Insufficient credits. Upgrade to Premium for more!")
      return
    }

    setIsLoading(true)
    const userMessage = message

    try {
      if (!isAutomated) { // Deduct only manual
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
            alert("Insufficient credits. Please wait for regeneration or upgrade.")
            return
          }
          alert(errData.error || "Failed to process your request. Please try again.")
          return
        }

        await refetchCredits()
      }

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
          createdAt: new Date(),
          thinking: null,
          searchQueries: null,
          isAutomated: false,
        }
        onNewMessage(tempUser)

        const tempAssistantId = `temp-assistant-${Date.now()}`
        const tempAssistant: Message = {
          id: tempAssistantId,
          projectId,
          role: "assistant",
          content: "",
          hasArtifact: false,
          createdAt: new Date(),
          thinking: null,
          searchQueries: null,
          isAutomated: false,
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
              discussMode: isDiscussMode,
              isAutomated, // New: Pass flag
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
          let lineBuffer = "" // Added buffer to handle incomplete SSE lines
          let streamError = false

          while (true) {
            try {
              const { done, value } = await reader.read()
              if (done) {
                console.log("[v0] Stream completed")
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              lineBuffer += chunk
              const lines = lineBuffer.split("\n")

              lineBuffer = lines[lines.length - 1]

              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i]
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

                      onNewMessage({
                        ...tempAssistant,
                        content: accumulated,
                        id: tempAssistantId,
                        isAutomated: false,
                      })
                    }

                    if (data.done) {
                      console.log("[v0] Received done signal, message ID:", data.messageId)

                      onNewMessage({
                        id: data.messageId || `final-${Date.now()}`,
                        projectId,
                        role: "assistant",
                        content: accumulated,
                        hasArtifact: data.hasArtifact ?? false,
                        createdAt: new Date(),
                        thinking: null,
                        searchQueries: null,
                        isAutomated: false,
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
            discussMode: isDiscussMode,
            isAutomated,
          }),
        })
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            model: selectedModel,
            discussMode: isDiscussMode,
            isAutomated, // New
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

  const handleUpgradeClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowPricingModal(true)
  }

  useImperativeHandle(
    ref,
    () => ({
      insertPrompt: (prompt: string) => {
        setMessage((prev) => prev + (prev.trim() ? "\n\n" : "") + prompt)
        setTimeout(() => {
          textareaRef.current?.focus()
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight
          }
        }, 0)
      },
    }),
    [],
  )

  if (!isLoaded || !isAuthenticated) {
    return (
      <div className="space-y-2">
        <div className="relative bg-[#ffffff]  rounded-md overflow-hidden">
          <textarea
            placeholder={placeholder}
            className="w-full min-h-[80px] max-h-[150px] resize-none bg-transparent text-white placeholder:text-muted-foreground px-3 pt-3 pb-12 text-base outline-none overflow-y-auto field-sizing-content disabled:cursor-not-allowed disabled:opacity-50"
            disabled
          />
          <div className="absolute top-0 right-0 flex items-center justify-between px-3 py-2 bg-[#ffffff]">
            <div className="flex gap-1.5">
              <Link href={"/sign-in"}>
                <button className="text-sm font-medium cursor-pointer w-[70px] bg-[#ff8c00c0] p-1 rounded-md text-[#e9e9e9]">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const formRoundedClass = connected ? "rounded-t-[13px]" : "rounded-[13px]"
  const formBorderClass = connected ? "border-b-0" : "border-3"

  const showUpgradeButton = creditsData && !creditsData.isPremium && creditsData.credits <= 0 && !isAutomated

  return (
    <div className="">
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview || "/placeholder.svg"}
            alt="Upload preview"
            className="h-16 rounded border border-border"
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

      <form
        onSubmit={handleSubmit}
        className={`relative bg-[#ffffff] border border-[#d6d6d6] p-1 ${formRoundedClass}`} //${formBorderClass}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isDiscussMode ? "Discuss anything..." : placeholder}
          className="w-full min-h-[100px] max-h-[150px] resize-none bg-transparent text-black placeholder:text-muted-foreground
                     px-3 pt-3 pb-10 text-base outline-none overflow-y-auto field-sizing-content chat-messages-scroll
                     disabled:cursor-not-allowed disabled:opacity-50"
          style={{ scrollbarWidth: "thin" }}
          disabled={isLoading}
        />

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2 bg-[#ffff] rounded-[9px]">
          <div className="flex gap-1 items-center">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-2 text-sm text-white/75 hover:text-white hover:bg-[#e4e4e4] h-auto ml-1"
              title="Upload image"
              disabled={isLoading}
              variant="ghost"
              size="sm"
            >
              <img width={13} height={13} src="/icons/plus_light.png" alt="" />
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

            <Button
              type="button"
              onClick={handleImprovePrompt}
              disabled={isImproving || !message.trim() || !projectId || isLoading}
              className="px-2 py-1 text-sm text-white/75 hover:text-white hover:bg-[#e4e4e4] h-auto ml-1"
              title="Improve prompt"
              variant="ghost"
              size="sm"
            >
              {!isImproving ? (
                <img width={16} height={16} src="/icons/enhance_prompt.png" alt="" />
              ) : (
                <span className="ml-1 animate-pulse">
                  <Loader />
                </span>
              )}
            </Button>

            <div className="relative" ref={dropdownRef}>
              <Button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="px-2 py-1 text-sm text-black/75 hover:text-white hover:bg-[#e4e4e4] h-auto ml-1"
                disabled={isLoading}
                variant="ghost"
                size="sm"
              >
                <img
                  src={modelOptions[selectedModel].icon || "/placeholder.svg"}
                  alt=""
                  className={`w-3.5 h-3.5 ${modelOptions[selectedModel].color}`}
                />
                <span className="text-black/75">{modelOptions[selectedModel].label}</span>
                {modelOptions[selectedModel].soon && (
                  <span className="text-xs bg-[#333333e7] text-white/70 p-1 rounded-4xl ml-1">SOON</span>
                )}
                <ChevronDown className="w-3 h-3 text-black/50" />
              </Button>

              {showModelDropdown && (
                <div className="absolute left-0 bottom-0 translate-y-1 bg-[#ffffff] border border-[#e0e0e0c9] rounded-md overflow-hidden p-1 z-50 min-w-[180px]">
                  {Object.entries(modelOptions).map(([key, option]) => {
                    const { label, icon, color, soon } = option
                    const isComingSoon = !!soon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (isComingSoon) {
                            alert(`${label} is coming soon!`)
                            return
                          }
                          setSelectedModel(key as ModelType)
                          setShowModelDropdown(false)
                        }}
                        disabled={isComingSoon}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4] ${
                          selectedModel === key ? "font-bold" : ""
                        } ${isComingSoon ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <img src={icon || "/placeholder.svg"} alt="" className={`w-3.5 h-3.5 ${color}`} />
                        <span className="text-black/75">{label}</span>
                        {soon && <span className="text-xs text-white/70 bg-[#333333e7] w-[35%] rounded-4xl">SOON</span>}
                        {selectedModel === key && !isComingSoon && <span className="ml-auto text-green-400">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {connected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCloseIdeas}
                className="px-2 py-2 text-sm text-black/75 hover:text-black hover:bg-[#e4e4e4] h-auto ml-1"
              >
                Close
              </Button>
            )}
          </div>

          {/* Updated: Conditional send/upgrade button */}
          {showUpgradeButton ? (
            <Button
              type="button"
              onClick={handleUpgradeClick}
              size="icon"
              className="h-7 w-20 p-1.5 bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black"
              disabled={isLoading}
            >
              Upgrade
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="h-7 w-7 p-1.5 bg-[#2f2f30]"
              disabled={!message.trim() || isLoading || !isAuthenticated || !!modelOptions[selectedModel]?.soon}
            >
              <img width={16} height={16} src="/mouse-cursor.png" alt="" />
            </Button>
          )}
        </div>
      </form>

      {/* New: Pricing Modal */}
      <PricingModal
        open={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        onSuccess={refetchCredits}
      />
    </div>
  )
})

export function ChatInput(props: ChatInputProps) {
  return <ChatInputImpl {...props} />
}