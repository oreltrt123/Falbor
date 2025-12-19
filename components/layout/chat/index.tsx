"use client"

import type React from "react"
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { AlertCircle, Palette, StarsIcon } from "lucide-react"
import { Loader, X, Mic, Plus, Circle, MoreHorizontal, ArrowLeft } from "lucide-react"
import type { Message } from "@/config/schema"
import Link from "next/link"
import { PricingModal } from "@/components/models/PricingModal"
import { FileModal } from "@/components/models/FileModal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link1Icon } from "@radix-ui/react-icons"

interface ChatInputProps {
  isAuthenticated: boolean
  projectId?: string
  onNewMessage?: (message: Message) => void
  placeholder?: string
  initialModel?: string
  connected?: boolean
  onCloseIdeas?: () => void
  isAutomated?: boolean
  previewError?: {
    message: string
    file?: string
    line?: string
  } | null
  onDismissError?: () => void
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

type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss" | "runware"

type DesignConfig = {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonStyle: "rounded" | "square" | "pill"
  borderStyle: "solid" | "dashed" | "none"
}

const designSystems = [
  { name: "Base", previewColor: "bg-black" },
  { name: "Mono", previewColor: "bg-gray-500" },
  { name: "Cosmic Night", previewColor: "bg-purple-900" },
  { name: "Soft Pop", previewColor: "bg-green-500" },
  { name: "Neo Brutalism", previewColor: "bg-yellow-500" },
  { name: "Vintage Paper", previewColor: "bg-amber-300" },
  { name: "Modern Minimal", previewColor: "bg-blue-200" },
  { name: "Bubblegum", previewColor: "bg-pink-400" },
]

const designPresets: Record<string, DesignConfig> = {
  Base: {
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    backgroundColor: "#ffffff",
    textColor: "#000000",
    buttonStyle: "rounded",
    borderStyle: "solid",
  },
  Mono: {
    primaryColor: "#333333",
    secondaryColor: "#666666",
    backgroundColor: "#f0f0f0",
    textColor: "#000000",
    buttonStyle: "square",
    borderStyle: "none",
  },
  "Cosmic Night": {
    primaryColor: "#4b0082",
    secondaryColor: "#ffffff",
    backgroundColor: "#000000",
    textColor: "#ffffff",
    buttonStyle: "rounded",
    borderStyle: "dashed",
  },
  "Soft Pop": {
    primaryColor: "#00ff00",
    secondaryColor: "#ff4500",
    backgroundColor: "#ffffff",
    textColor: "#000000",
    buttonStyle: "pill",
    borderStyle: "solid",
  },
  "Neo Brutalism": {
    primaryColor: "#ffff00",
    secondaryColor: "#ff0000",
    backgroundColor: "#ffffff",
    textColor: "#000000",
    buttonStyle: "square",
    borderStyle: "solid",
  },
  "Vintage Paper": {
    primaryColor: "#8b4513",
    secondaryColor: "#f4e8d4",
    backgroundColor: "#f4e8d4",
    textColor: "#4b2e0b",
    buttonStyle: "rounded",
    borderStyle: "dashed",
  },
  "Modern Minimal": {
    primaryColor: "#007bff",
    secondaryColor: "#6c757d",
    backgroundColor: "#ffffff",
    textColor: "#212529",
    buttonStyle: "square",
    borderStyle: "none",
  },
  Bubblegum: {
    primaryColor: "#ff69b4",
    secondaryColor: "#ffb6c1",
    backgroundColor: "#fff0f5",
    textColor: "#c71585",
    buttonStyle: "pill",
    borderStyle: "solid",
  },
}

const ChatInputImpl = forwardRef<ChatInputRef, ChatInputProps>(function ChatInputImpl(
  {
    isAuthenticated,
    projectId,
    onNewMessage,
    placeholder = "What would you like to build today?",
    initialModel = "hybrid",
    connected = false,
    onCloseIdeas,
    isAutomated = false,
    previewError,
    onDismissError,
  },
  ref,
) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; content: string; type: string; displayName: string }>
  >([])
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
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
  const [selectedModel, setSelectedModel] = useState<ModelType>(initialModel as ModelType)
  const [showMenu, setShowMenu] = useState(false)
  const [menuMode, setMenuMode] = useState<"main" | "design">("main")
  const [showDesignModal, setShowDesignModal] = useState(false)
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null)
  const [designConfig, setDesignConfig] = useState<DesignConfig | null>(null)
  const [tempConfig, setTempConfig] = useState<DesignConfig>(designPresets["Base"])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
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

  const draftKey = projectId ? `chat-draft-${projectId}` : "chat-draft-global"
  const designKey = "chat-design-config"

  // Load draft
  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey)
    if (savedDraft && savedDraft.trim()) {
      setMessage(savedDraft)
    }
  }, [draftKey])

  // Load / save design
  useEffect(() => {
    const savedDesign = localStorage.getItem(designKey)
    if (savedDesign) {
      const parsed = JSON.parse(savedDesign)
      setSelectedDesign(parsed.name)
      setDesignConfig(parsed.config)
    }
  }, [])

  useEffect(() => {
    if (selectedDesign && designConfig) {
      localStorage.setItem(designKey, JSON.stringify({ name: selectedDesign, config: designConfig }))
    }
  }, [selectedDesign, designConfig])

  // Visualizer drawing
  const drawVisualizer = () => {
    const canvas = canvasRef.current
    if (!canvas || !analyserRef.current) return

    const ctx = canvas.getContext("2d")
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
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.scale(dpr, dpr)
      drawVisualizer()
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [isListening])

  // Fetch enabled models
  useEffect(() => {
    const fetchEnabledModels = async () => {
      if (!user?.id || !isLoaded) return
      try {
        const res = await fetch("/api/user/model-config")
        if (res.ok) {
          const data = await res.json()
          setEnabledModels(data.enabledModels || ["gemini", "claude", "gpt", "deepseek", "gptoss", "runware"])
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

  // Credits fetching
  const fetchCredits = async () => {
    if (!user?.id || !isLoaded) return
    try {
      const res = await fetch("/api/user/credits")
      if (res.ok) {
        const data: CreditsData = await res.json()
        setCreditsData(data)
        setTimeLeft(data.secondsUntilNextRegen)
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
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
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user?.id, isLoaded, isAuthenticated])

  const refetchCredits = async () => {
    if (!user?.id) return
    await fetchCredits()
  }

  // File / image handlers
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
        const firstLine = content.split("\n")[0]?.trim() || ""
        let displayName =
          firstLine
            ? `${firstLine.split(/\s+/).slice(0, 5).join(" ")}...`
            : file.name
        displayName = displayName.substring(0, 40)
        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, content, type: file.type || "text/plain", displayName },
        ])
      }
      reader.readAsText(file)
    })

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Prompt improvement – blocked for guests
  const handleImprovePrompt = async () => {
    if (!isAuthenticated) {
      return
    }

    if (!message.trim() || isImproving) return
    setIsImproving(true)

    let liveText = ""

    try {
      const body = projectId ? { projectId, prompt: message } : { prompt: message }
      const res = await fetch("/api/chat/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error(`Failed to improve prompt: ${res.status}`)

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
              if (data.done) setMessage(data.improvedPrompt)
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

  // Voice input
  const stopVoiceInput = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
    recognitionRef.current = null
    lastTranscriptRef.current = ""
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) audioContextRef.current.close()
    audioContextRef.current = null
    analyserRef.current = null
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
  }

  const handleVoiceToggle = async () => {
    if (isListening) {
      stopVoiceInput()
      return
    }

    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
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

      const SpeechRecognitionConstructor =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
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
          setMessage((prev) => {
            const newMessage = prev + added
            localStorage.setItem(draftKey, newMessage)
            return newMessage
          })
        }
        lastTranscriptRef.current = transcript
      }

      recognition.onerror = () => stopVoiceInput()
      recognition.onend = () => stopVoiceInput()

      recognition.start()
      recognitionRef.current = recognition
      lastTranscriptRef.current = ""
      setIsListening(true)
    } catch (err) {
    }
  }

  // Submit – redirect guests to sign-in
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

    if (!isAuthenticated) {
      router.push("/sign-in")
      return
    }

    if (!message.trim() && uploadedFiles.length === 0 && !designConfig) return

    if (creditsData && !creditsData.isPremium && creditsData.credits <= 0 && !isAutomated) {
      return
    }

    setIsLoading(true)
    let userMessage = message.trim()

    if (uploadedFiles.length > 0) {
      const fileSections = uploadedFiles
        .map(
          (file) =>
            `\n\n## File: ${file.name}\n\`\`\`${file.type.split("/")[1] || "text"}\n${file.content}\n\`\`\``,
        )
        .join("")
      userMessage = userMessage ? `${userMessage}${fileSections}` : fileSections.slice(1)
    }

    if (designConfig) {
      userMessage += `\n\n## Design System: ${selectedDesign || "Custom"}\n${JSON.stringify(designConfig, null, 2)}`
    }

    try {
      if (!isAutomated) {
        const deductRes = await fetch("/api/user/credits", { method: "POST" })
        if (!deductRes.ok) {
          if (deductRes.status === 401) {
            router.push("/sign-in")
            return
          }
          if (deductRes.status === 402) {
            return
          }
          return
        }
        await refetchCredits()
      }

      localStorage.removeItem(draftKey)
      setMessage("")
      setSelectedImage(null)
      setImagePreview(null)
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

        abortControllerRef.current = new AbortController()

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            message: userMessage,
            imageData: selectedImage,
            uploadedFiles: null,
            discussMode: isDiscussMode,
            isAutomated,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!res.ok) throw new Error(`API error ${res.status}`)

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader!.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n").filter(Boolean)

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.text) {
                  accumulated += data.text
                  onNewMessage({ ...tempAssistant, content: accumulated, id: tempAssistantId })
                }
                if (data.done) {
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
              } catch {}
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleFixError = () => {
    if (!previewError || !projectId) return
    const fixPrompt = `Fix this preview error:\n\nError: ${previewError.message}\n${
      previewError.file ? `File: ${previewError.file}\n` : ""
    }${previewError.line ? `Line: ${previewError.line}` : ""}\n\nPlease fix the code.`
    setMessage(fixPrompt)
    localStorage.setItem(draftKey, fixPrompt)
    onDismissError?.()
  }

  useImperativeHandle(ref, () => ({
    insertPrompt: (prompt: string) => {
      setMessage((prev) => {
        const newMessage = prev + (prev.trim() ? "\n\n" : "") + prompt
        localStorage.setItem(draftKey, newMessage)
        return newMessage
      })
      textareaRef.current?.focus()
    },
  }))

  const formRoundedClass = connected ? "rounded-t-[13px]" : "rounded-md"
  const showUpgradeButton =
    isAuthenticated && creditsData && !creditsData.isPremium && creditsData.credits <= 0 && !isAutomated

  const isSendDisabled = isLoading || (!isListening && !message.trim() && uploadedFiles.length === 0)

  return (
    <div className="">
      {/* Uploaded files preview */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-md">
          {uploadedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 bg-white border border-gray-200 hover:border-gray-300 rounded-md transition-colors"
            >
              <button
                type="button"
                onClick={() => setSelectedFile({ name: file.name, content: file.content })}
                className="px-3 py-2 text-sm text-gray-700 truncate max-w-[200px] hover:bg-gray-50"
              >
                {file.displayName}
              </button>
              <button
                type="button"
                onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                className="pr-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="relative inline-block mb-2">
          <img src={imagePreview} alt="Upload preview" className="h-16 rounded border border-border" />
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

      {/* Preview error banner */}
      {previewError && (
        <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 flex items-start justify-between mb-3 shadow-sm">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-900 mb-1">Preview Error</p>
              <p className="text-sm text-red-700 break-words">{previewError.message}</p>
              {previewError.file && (
                <p className="text-xs text-red-600 mt-1">
                  {previewError.file}
                  {previewError.line && ` (Line ${previewError.line})`}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-3">
            <Button size="sm" variant="outline" onClick={handleFixError} className="h-8 px-3 text-xs">
              Fix Problem
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismissError} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`relative bg-[#ecececdc] border border-[#dbd9d9b2] p-1 ${formRoundedClass}`}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            const newMessage = e.target.value
            setMessage(newMessage)
            localStorage.setItem(draftKey, newMessage)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full min-h-[100px] max-h-[150px] resize-none bg-transparent text-black placeholder:text-muted-foreground px-2 pt-2 pb-10 text-base outline-none overflow-y-auto field-sizing-content font-light"
          disabled={isLoading}
        />

        <div className="absolute bottom-1 left-0 right-0 flex items-center justify-between p-1 bg-[#e7e7e700] rounded-[19px]">
          {isListening ? (
            <div className="flex-1 relative h-10 mr-2">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-gray-100 rounded" />
            </div>
          ) : (
            <div className="flex items-center relative" ref={menuRef}>
              <DropdownMenu open={showMenu} onOpenChange={(open) => { setShowMenu(open); if (!open) setMenuMode("main") }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-1.5 rounded-md hover:bg-[#e7e7e7] text-black ml-1"
                    disabled={isLoading}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  {menuMode === "main" ? (
                    <>
                      <DropdownMenuItem
                        onSelect={() => {
                          fileInputRef.current?.click()
                          setShowMenu(false)
                        }}
                        disabled={isLoading}
                      >
                        <Link1Icon className="h-4 w-4 mr-2" />
                        Attach images & files
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setMenuMode("design")}>
                        <Palette className="h-4 w-4 mr-2" />
                        System Design
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          handleImprovePrompt()
                          setShowMenu(false)
                        }}
                        disabled={isImproving || !message.trim() || isLoading}
                      >
                        {isImproving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <StarsIcon className="h-4 w-4 mr-2" />}
                        Enhance Prompt
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => setMenuMode("main")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </DropdownMenuItem>
                      {designSystems.map((system) => (
                        <DropdownMenuItem
                          key={system.name}
                          onSelect={() => {
                            setSelectedDesign(system.name)
                            setDesignConfig(designPresets[system.name])
                            setShowMenu(false)
                          }}
                        >
                          <div className={`h-4 w-4 rounded mr-2 ${system.previewColor}`} />
                          {system.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem
                        onSelect={() => {
                          setSelectedDesign("Custom")
                          setShowDesignModal(true)
                          setShowMenu(false)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Design System
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

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

          <input
            ref={fileInputRef}
            type="file"
            accept=".ts,.tsx,.js,.jsx,.py,.css,.html,.json,.md,.txt,image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              const imageFile = files.find((f) => f.type.startsWith("image/"))
              if (imageFile) handleImageUpload({ target: { files: [imageFile] } } as any)
              handleFileUpload(e)
            }}
            className="hidden"
          />

          <div className="flex items-center gap-px">
            {!isListening && (
              <Button
                type="button"
                onClick={handleVoiceToggle}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-1.5 rounded-md hover:bg-[#e7e7e7] text-black"
                disabled={isLoading}
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}

            {showUpgradeButton ? (
              <Link href="/pricing">
                <Button type="button" className="h-7 w-20 p-1.5 bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black">
                  Upgrade
                </Button>
              </Link>
            ) : !isAuthenticated ? (
              <Link href="/sign-in">
                <Button
                  type="button"
                  className="h-7 w-20 px-4 bg-white hover:bg-gray-100 text-black rounded-md font-medium mr-1"
                >
                  Sign In
                </Button>
              </Link>
            ) : (
              <Button
                type={isListening ? "button" : "submit"}
                onClick={isListening ? stopVoiceInput : undefined}
                className={`h-7 w-7 p-1.5 rounded-md mr-1 ${isListening ? "bg-red-500 hover:bg-red-600" : "bg-[rgba(40,40,40,0.65)]"}`}
                disabled={isSendDisabled}
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 animate-spin text-white" />
                ) : isListening ? (
                  <Circle className="w-4 h-4 text-white" />
                ) : (
                  <img width={16} height={16} src="/mouse-cursor.png" alt="Send" />
                )}
              </Button>
            )}
          </div>
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

      <Dialog open={showDesignModal} onOpenChange={setShowDesignModal}>
        <DialogContent>
          <DialogTitle>Customize Design System</DialogTitle>
          <div className="grid gap-4 py-4">
            {/* Color and style pickers – unchanged from original */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="primaryColor" className="text-right">Primary</Label>
              <Input id="primaryColor" type="color" value={tempConfig.primaryColor} onChange={(e) => setTempConfig({ ...tempConfig, primaryColor: e.target.value })} className="col-span-3" />
            </div>
            {/* Repeat for secondary, background, text, buttonStyle, borderStyle */}
          </div>
          <Button onClick={() => { setDesignConfig(tempConfig); setShowDesignModal(false) }}>
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export function ChatInput(props: ChatInputProps) {
  return <ChatInputImpl {...props} />
}