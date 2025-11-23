"use client"

import type React from "react"
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { ChevronDown, Loader, X, Mic, Plus, Circle } from "lucide-react"
import type { Message } from "@/config/schema"
import Link from "next/link"
import { PricingModal } from "@/components/models/PricingModal"
import { FileModal } from "@/components/models/FileModal"
import { MagicWandIcon } from "@radix-ui/react-icons"

interface ChatInputProps {
  isAuthenticated: boolean
  projectId?: string
  onNewMessage?: (message: Message) => void
  placeholder?: string
  initialModel?: string
  connected?: boolean
  onCloseIdeas?: () => void
  isAutomated?: boolean
}

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
  isPremium: boolean
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

export type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss" | "runware"

const ChatInputImpl = forwardRef<ChatInputRef, ChatInputProps>(function ChatInputImpl(
  {
    isAuthenticated,
    projectId,
    onNewMessage,
    placeholder = "What would you like to build today?",
    initialModel = "gemini",
    connected = false,
    onCloseIdeas,
    isAutomated = false,
  },
  ref,
) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; type: string }>>([])
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedModel, setSelectedModel] = useState<ModelType>(initialModel as ModelType)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [isDiscussMode, setIsDiscussMode] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
  const [enabledModels, setEnabledModels] = useState<ModelType[]>([
    "gemini",
    "claude",
    "gpt",
    "deepseek",
    "gptoss",
    "runware",
  ])
  const [isListening, setIsListening] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<any>(null)
  const lastTranscriptRef = useRef("")
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const router = useRouter()
  const { user, isLoaded } = useUser()

  const modelOptions: Record<ModelType, ModelOption> = {
    gemini: { label: "Gemini 3 Pro", icon: "/icons/gemini.png", color: "text-blue-400" },
    claude: { label: "Claude Sonnet 4.5", icon: "/icons/claude.png", color: "text-purple-400" },
    gpt: { label: "GPT-5", icon: "/icons/openai.png", color: "text-green-400" },
    deepseek: { label: "Deepseek R3", icon: "/icons/deepseek.png", color: "text-teal-400" },
    gptoss: { label: "GPT-OSS 20B", icon: "/icons/openai.png", color: "text-green-400" },
    runware: { label: "Runware AI Images", icon: "/icons/runware.png", color: "text-orange-400" },
  }

  const drawVisualizer = () => {
    const canvas = canvasRef.current
    if (!canvas || !analyserRef.current) {
      if (animationRef.current) {
        animationRef.current = requestAnimationFrame(drawVisualizer)
      }
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    analyser.getByteFrequencyData(dataArray)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const barWidth = (canvas.width / bufferLength) * 2.5
    let barHeight
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height

      ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`
      ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2)

      x += barWidth + 1
    }

    animationRef.current = requestAnimationFrame(drawVisualizer)
  }

  useEffect(() => {
    if (isListening && canvasRef.current) {
      const canvas = canvasRef.current
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
      drawVisualizer()
    } else if (!isListening && animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [isListening])

  useEffect(() => {
    const fetchEnabledModels = async () => {
      if (!user?.id || !isLoaded) return
      try {
        const res = await fetch("/api/user/model-config")
        if (res.ok) {
          const data = await res.json()
          setEnabledModels(data.enabledModels || ["gemini", "claude", "gpt", "deepseek", "gptoss", "runware"])
          // If current selected model is disabled, switch to first enabled model
          if (!data.enabledModels.includes(selectedModel)) {
            setSelectedModel(data.enabledModels[0] || "gemini")
          }
        }
      } catch (err) {
        console.error("[v0] Failed to fetch enabled models:", err)
      }
    }
    fetchEnabledModels()
  }, [user?.id, isLoaded])

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    const nonImageFiles = files.filter((file) => !file.type.startsWith("image/"))

    nonImageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            content,
            type: file.type || "text/plain",
          },
        ])
      }
      reader.readAsText(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
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

  const stopVoiceInput = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
    recognitionRef.current = null
    lastTranscriptRef.current = ""
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  const handleVoiceToggle = async () => {
    if (isListening) {
      stopVoiceInput()
      return
    }

    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyserRef.current = analyser
      analyser.fftSize = 256
      source.connect(analyser)

      const SpeechRecognitionConstructor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognitionConstructor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event: any) => {
        let transcript = ""
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript
        }

        const added = transcript.substring(lastTranscriptRef.current.length)
        if (added) {
          setMessage((prev) => prev + added)
          setTimeout(() => {
            textareaRef.current?.focus()
            if (textareaRef.current) {
              textareaRef.current.scrollTop = textareaRef.current.scrollHeight
            }
          }, 0)
        }
        lastTranscriptRef.current = transcript
      }

      recognition.onerror = (event: any) => {
        console.error("Voice recognition error:", event.error)
        stopVoiceInput()
      }

      recognition.onend = () => {
        stopVoiceInput()
      }

      recognition.start()
      recognitionRef.current = recognition
      lastTranscriptRef.current = ""
      setIsListening(true)
    } catch (err) {
      console.error("Failed to start voice recognition:", err)
      alert("Could not access microphone. Please check permissions and try again.")
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
    if (isLoading) {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      setIsLoading(false)
      return
    }

    if (isListening) {
      stopVoiceInput()
      return
    }

    if (!message.trim()) return

    const currentOption = modelOptions[selectedModel]
    if (currentOption?.soon) {
      alert(`${currentOption.label} is coming soon! Please select another model.`)
      return
    }

    if (isLoaded && creditsData && !creditsData.isPremium && creditsData.credits <= 0 && !isAutomated) {
      alert("Insufficient credits. Upgrade to Premium for more!")
      return
    }

    setIsLoading(true)
    const userMessage = message

    try {
      if (!isAutomated) {
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
      const filesToSend = uploadedFiles
      setUploadedFiles([])

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

        abortControllerRef.current = new AbortController()

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              message: userMessage,
              imageData: selectedImage,
              uploadedFiles: filesToSend.length > 0 ? filesToSend : null,
              model: selectedModel,
              discussMode: isDiscussMode,
              isAutomated,
            }),
            signal: abortControllerRef.current.signal,
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
          let lineBuffer = ""
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
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            console.log("[v0] Request aborted by user")
          } else {
            console.error("[v0] Fetch error:", fetchError)
            alert(`Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
          }
        } finally {
          abortControllerRef.current = null
        }
      } else if (projectId) {
        abortControllerRef.current = new AbortController()
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            message: userMessage,
            imageData: selectedImage,
            uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : null,
            model: selectedModel,
            discussMode: isDiscussMode,
            isAutomated,
          }),
          signal: abortControllerRef.current.signal,
        })
        abortControllerRef.current = null
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            model: selectedModel,
            discussMode: isDiscussMode,
            isAutomated,
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
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {uploadedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 bg-[#e4e4e4] hover:bg-[#d4d4d4] rounded-md transition-colors"
            >
              <button
                type="button"
                onClick={() => setSelectedFile({ name: file.name, content: file.content })}
                className="px-3 py-2 text-sm text-black/75 truncate max-w-[200px]"
              >
                {file.name}
              </button>
              <button
                type="button"
                onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                className="pr-2 text-black/50 hover:text-black/75"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {imagePreview && (
        <div className="relative inline-block mb-2">
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

      <form onSubmit={handleSubmit} className={`relative bg-[#ffffff] border border-[#dbd9d9] p-1 ${formRoundedClass}`}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isDiscussMode ? "Discuss anything..." : placeholder}
          className="w-full min-h-[100px] max-h-[150px] resize-none bg-transparent text-black placeholder:text-muted-foreground
                     px-3 pt-3 pb-10 text-base outline-none overflow-y-auto field-sizing-content chat-messages-scroll font-light
                     disabled:cursor-not-allowed disabled:opacity-50"
          style={{ scrollbarWidth: "thin" }}
          disabled={isLoading}
        />

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2 bg-[#ffff] rounded-[19px]">
          {isListening ? (
            <div className="flex-1 relative h-10 mr-2 p-[-14px]">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full bg-gray-100 rounded"
              />
            </div>
          ) : (
            <div className="flex gap-1 items-center">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-2 text-sm text-black/75 hover:text-black hover:bg-[#e4e4e48c] h-auto ml-1"
                title="Upload files"
                disabled={isLoading}
                variant="ghost"
                size="sm"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ts,.tsx,.js,.jsx,.py,.css,.html,.json,.md,.txt,image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  const imageFile = files.find((f) => f.type.startsWith("image/"))

                  if (imageFile) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const base64 = ev.target?.result as string
                      setSelectedImage({ data: base64.split(",")[1], mimeType: imageFile.type })
                      setImagePreview(base64)
                    }
                    reader.readAsDataURL(imageFile)
                  }

                  handleFileUpload(e)
                }}
                className="hidden"
              />

              <Button
                type="button"
                onClick={handleVoiceToggle}
                className="px-2 py-2 text-sm text-black/75 hover:text-black hover:bg-[#e4e4e48c] h-auto ml-1"
                title="Voice input"
                disabled={isLoading}
                variant="ghost"
                size="sm"
              >
                <Mic className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                onClick={handleImprovePrompt}
                disabled={isImproving || !message.trim() || !projectId || isLoading}
                className="px-2 py-2 text-sm text-black/75 hover:text-black hover:bg-[#e4e4e48c] h-auto ml-1"
                title="Improve prompt"
                variant="ghost"
                size="sm"
              >
                {!isImproving ? (
                 <MagicWandIcon />
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
                  className="px-2 py-1 text-sm text-black/75 hover:text-white hover:bg-[#e4e4e48c] h-auto ml-1"
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
                  <div className="absolute left-0 bottom-0 translate-y-1 bg-[#ffffff] border border-[#e0e0e0c9] rounded-md overflow-hidden p-1 z-50 min-w-[220px]">
                    {Object.entries(modelOptions).map(([key, option]) => {
                      // Only show enabled models
                      if (!enabledModels.includes(key as ModelType)) {
                        return null
                      }

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
                            selectedModel === key ? "" : ""
                          } ${isComingSoon ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <img src={icon || "/placeholder.svg"} alt="" className={`w-3.5 h-3.5 ${color}`} />
                          <span className="text-black/75">{label}</span>
                          {soon && <span className="text-xs text-white/70 bg-[#333333e7] w-[35%] rounded-4xl">SOON</span>}
                          {selectedModel === key && !isComingSoon && <span className="ml-auto text-black">✓</span>}
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
                  className="px-2 py-1 text-sm text-black/75 hover:text-black hover:bg-[#e4e4e48c] h-auto ml-1"
                >
                  Close
                </Button>
              )}
            </div>
          )}

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
              type={isListening ? "button" : "submit"}
              onClick={isListening ? stopVoiceInput : undefined}
              size="icon"
              className={`h-7 w-7 p-1.5 rounded-md ${isListening ? "bg-red-500 hover:bg-red-600" : "bg-[#0099FF]"}`}
              disabled={isLoading || (!isListening && (!message.trim() || !isAuthenticated || !!modelOptions[selectedModel]?.soon))}
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin text-white" />
              ) : isListening ? (
                <Circle className="w-4 h-4 text-white" />
              ) : (
                <img width={16} height={16} src="/mouse-cursor.png" alt="" />
              )}
            </Button>
          )}
        </div>
      </form>

      <PricingModal open={showPricingModal} onClose={() => setShowPricingModal(false)} onSuccess={refetchCredits} />

      {selectedFile && (
        <FileModal
          open={!!selectedFile}
          onClose={() => setSelectedFile(null)}
          fileName={selectedFile.name}
          fileContent={selectedFile.content}
        />
      )}
    </div>
  )
})

export function ChatInput(props: ChatInputProps) {
  return <ChatInputImpl {...props} />
}