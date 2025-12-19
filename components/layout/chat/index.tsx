"use client"

import type React from "react"
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { AlertCircle, ChartBarDecreasingIcon, Palette, StarsIcon } from "lucide-react"
import { Loader, X, Mic, Plus, Circle, MoreHorizontal, ArrowLeft } from "lucide-react"
import type { Message } from "@/config/schema"
import Link from "next/link"
import { PricingModal } from "@/components/models/PricingModal"
import { FileModal } from "@/components/models/FileModal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

interface ModelOption {
  label: string
  icon: string
  color: string
  soon?: string
}

export type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss" | "runware"

type DesignConfig = {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  buttonStyle: 'rounded' | 'square' | 'pill'
  borderStyle: 'solid' | 'dashed' | 'none'
}

const designSystems = [
  { name: 'Base', previewColor: 'bg-black' },
  { name: 'Mono', previewColor: 'bg-gray-500' },
  { name: 'Cosmic Night', previewColor: 'bg-purple-900' },
  { name: 'Soft Pop', previewColor: 'bg-green-500' },
  { name: 'Neo Brutalism', previewColor: 'bg-yellow-500' },
  { name: 'Vintage Paper', previewColor: 'bg-amber-300' },
  { name: 'Modern Minimal', previewColor: 'bg-blue-200' },
  { name: 'Bubblegum', previewColor: 'bg-pink-400' },
]

const designPresets: Record<string, DesignConfig> = {
  'Base': {
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    buttonStyle: 'rounded',
    borderStyle: 'solid',
  },
  'Mono': {
    primaryColor: '#333333',
    secondaryColor: '#666666',
    backgroundColor: '#f0f0f0',
    textColor: '#000000',
    buttonStyle: 'square',
    borderStyle: 'none',
  },
  'Cosmic Night': {
    primaryColor: '#4b0082',
    secondaryColor: '#ffffff',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    buttonStyle: 'rounded',
    borderStyle: 'dashed',
  },
  'Soft Pop': {
    primaryColor: '#00ff00',
    secondaryColor: '#ff4500',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    buttonStyle: 'pill',
    borderStyle: 'solid',
  },
  'Neo Brutalism': {
    primaryColor: '#ffff00',
    secondaryColor: '#ff0000',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    buttonStyle: 'square',
    borderStyle: 'solid',
  },
  'Vintage Paper': {
    primaryColor: '#8b4513',
    secondaryColor: '#f4e8d4',
    backgroundColor: '#f4e8d4',
    textColor: '#4b2e0b',
    buttonStyle: 'rounded',
    borderStyle: 'dashed',
  },
  'Modern Minimal': {
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
    backgroundColor: '#ffffff',
    textColor: '#212529',
    buttonStyle: 'square',
    borderStyle: 'none',
  },
  'Bubblegum': {
    primaryColor: '#ff69b4',
    secondaryColor: '#ffb6c1',
    backgroundColor: '#fff0f5',
    textColor: '#c71585',
    buttonStyle: 'pill',
    borderStyle: 'solid',
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
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [menuMode, setMenuMode] = useState<'main' | 'design'>('main')
  const [showDesignModal, setShowDesignModal] = useState(false)
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null)
  const [designConfig, setDesignConfig] = useState<DesignConfig | null>(null)
  const [tempConfig, setTempConfig] = useState<DesignConfig>(designPresets['Base'])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
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
  const designKey = 'chat-design-config'

  // Load draft from localStorage on mount or projectId change
  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey)
    if (savedDraft && savedDraft.trim()) {
      setMessage(savedDraft)
    }
  }, [draftKey])

  // Load design from localStorage on mount
  useEffect(() => {
    const savedDesign = localStorage.getItem(designKey)
    if (savedDesign) {
      const parsed = JSON.parse(savedDesign)
      setSelectedDesign(parsed.name)
      setDesignConfig(parsed.config)
    }
  }, [])

  // Save design to localStorage when changed
  useEffect(() => {
    if (selectedDesign && designConfig) {
      localStorage.setItem(designKey, JSON.stringify({ name: selectedDesign, config: designConfig }))
    }
  }, [selectedDesign, designConfig])

  const drawVisualizer = () => {
    const canvas = canvasRef.current
    if (!canvas || !analyserRef.current) {
      if (animationRef.current) {
        animationRef.current = requestAnimationFrame(drawVisualizer)
      }
      return
    }

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
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
        const firstLine = content.split("\n")[0]?.trim() || ""
        let displayName
        if (firstLine) {
          const words = firstLine.split(/\s+/).slice(0, 5).join(" ")
          displayName = words ? `${words}...` : file.name
        } else {
          displayName = file.name
        }
        displayName = displayName.substring(0, 40) // Truncate if too long
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            content,
            type: file.type || "text/plain",
            displayName,
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

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error")
        throw new Error(`Failed to improve prompt: ${res.status} ${errorText}`)
      }

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
      alert(err instanceof Error ? err.message : "Failed to improve prompt. Please try again.")
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
      streamRef.current.getTracks().forEach((track) => track.stop())
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
          setMessage((prev) => {
            const newMessage = prev + added
            localStorage.setItem(draftKey, newMessage)
            return newMessage
          })
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
    if (showDesignModal) {
      setTempConfig(designConfig ?? designPresets['Base'])
    }
  }, [showDesignModal, designConfig])

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

    if (!message.trim() && uploadedFiles.length === 0 && !designConfig) return

    // const currentOption = modelOptions[selectedModel]
    // if (currentOption?.soon) {
    //   alert(`${currentOption.label} is coming soon! Please select another model.`)
    //   return
    // }

    if (isLoaded && creditsData && !creditsData.isPremium && creditsData.credits <= 0 && !isAutomated) {
      alert("Insufficient credits. Upgrade to Premium for more!")
      return
    }

    setIsLoading(true)
    let userMessage = message.trim()

    // Format uploaded files into the message for better organization
    if (uploadedFiles.length > 0) {
      const fileSections = uploadedFiles
        .map(
          (file) =>
            `\n\n## File: ${file.name}\n\`\`\`${file.type.split("/")[1] || "text/plain"}\n${file.content}\n\`\`\``,
        )
        .join("")
      userMessage = userMessage ? `${userMessage}${fileSections}` : fileSections.slice(1) // Remove leading \n if no message
    }

    if (designConfig) {
      userMessage += `\n\n## Design System: ${selectedDesign || 'Custom'}\n${JSON.stringify(designConfig, null, 2)}`
    }

    const filesToSend = [] // No longer sending raw files, formatted in message

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

      // Clear draft on successful submit
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

        console.log("[v0] Sending message to hybrid AI system")

        abortControllerRef.current = new AbortController()

        try {
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
            uploadedFiles: null,
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

  const handleFixError = () => {
    if (!previewError || !projectId) return

    const fixPrompt = `There's an error in the preview that needs to be fixed:

Error: ${previewError.message}
${previewError.file ? `File: ${previewError.file}` : ""}
${previewError.line ? `Line: ${previewError.line}` : ""}

Please analyze this error and fix it in the code. Make sure to:
1. Identify the root cause of the error
2. Fix the issue without breaking existing functionality
3. Ensure proper error handling is in place`

    setMessage(fixPrompt)
    localStorage.setItem(draftKey, fixPrompt)
    onDismissError?.()

    setTimeout(() => {
      textareaRef.current?.focus()
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.value.length
        textareaRef.current.selectionEnd = textareaRef.current.value.length
      }
    }, 0)
  }

  const handleDismissError = () => {
    onDismissError?.()
  }

  useImperativeHandle(
    ref,
    () => ({
      insertPrompt: (prompt: string) => {
        setMessage((prev) => {
          const newMessage = prev + (prev.trim() ? "\n\n" : "") + prompt
          localStorage.setItem(draftKey, newMessage)
          return newMessage
        })
        setTimeout(() => {
          textareaRef.current?.focus()
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight
          }
        }, 0)
      },
    }),
    [draftKey],
  )

  if (!isLoaded || !isAuthenticated) {
    return (
      <div className="space-y-2">
        <div className="relative bg-[#ecececdc] border border-[#dbd9d9b2] rounded-md overflow-hidden">
          <textarea
            placeholder={placeholder}
            className="w-full min-h-[80px] max-h-[150px] resize-none bg-transparent text-white placeholder:text-muted-foreground px-3 pt-3 pb-12 text-base outline-none overflow-y-auto field-sizing-content disabled:cursor-not-allowed disabled:opacity-50"
            disabled
          />
          <div className="absolute top-0 right-0 flex items-center justify-between px-3 py-2 bg-[#ececec00]">
            <div className="flex gap-1.5">
              <Link href={"/sign-in"}>
                <button className="text-sm font-medium cursor-pointer w-[70px] bg-[#ffffff] p-1 rounded-md text-[#000000]">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const formRoundedClass = connected ? "rounded-t-[13px]" : "rounded-md"
  const formBorderClass = connected ? "border-b-0" : "border-3"

  const showUpgradeButton = creditsData && !creditsData.isPremium && creditsData.credits <= 0 && !isAutomated

  return (
    <div className="">
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

      {/* Preview Error Banner – updated design & behavior */}
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleFixError}
              className="h-8 px-3 text-xs bg-white hover:bg-red-50 text-red-700 border-red-300"
            >
              Fix Problem
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismissError}
              className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit} className={`relative bg-[#ecececdc] border border-[#dbd9d9b2] p-1 ${formRoundedClass}`}>
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
          placeholder={isDiscussMode ? "Discuss anything..." : placeholder}
          className="w-full min-h-[100px] max-h-[150px] resize-none bg-transparent text-black placeholder:text-muted-foreground
                     px-2 pt-2 pb-10 text-base outline-none overflow-y-auto field-sizing-content chat-messages-scroll font-light
                     disabled:cursor-not-allowed disabled:opacity-50"
          style={{ scrollbarWidth: "thin" }}
          disabled={isLoading}
        />

        <div className="absolute bottom-1 left-0 right-0 flex items-center justify-between p-1 bg-[#e7e7e700] rounded-[19px]">
          {isListening ? (
            <div className="flex-1 relative h-10 mr-2 p-[-14px]">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-gray-100 rounded" />
            </div>
          ) : (
            <div className="flex items-center relative" ref={menuRef}>
              <DropdownMenu open={showMenu} onOpenChange={(open) => { setShowMenu(open); if (!open) setMenuMode('main'); }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="h-7 w-7 p-1.5 cursor-pointer text-sm rounded-md hover:bg-[#e7e7e7] text-black ml-1"
                    title="More options"
                    disabled={isLoading}
                    variant="ghost"
                    size="sm"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  className="w-[105%] mt-[-10px]"
                >
                  {menuMode === 'main' ? (
                    <>
                      <DropdownMenuItem
                        onSelect={() => {
                          fileInputRef.current?.click()
                          setShowMenu(false)
                        }}
                        disabled={isLoading}
                        className="w-full"
                      >
                        <Link1Icon className="h-4 w-4" />
                        Attach images & files
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        onSelect={() => setMenuMode('design')}
                        className="w-full"
                      >
                        <Palette className="h-4 w-4" />
                        System Design
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        onSelect={() => {
                          handleImprovePrompt()
                          setShowMenu(false)
                        }}
                        disabled={isImproving || !message.trim() || isLoading}
                        className="w-full"
                      >
                        {!isImproving ? (
                          <StarsIcon className="h-4 w-4" />
                        ) : (
                          <Loader className="h-4 w-4 animate-spin" />
                        )}
                        Enhance Prompt
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onSelect={() => setMenuMode('main')}
                        className="w-full"
                      >
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
                          className="w-full"
                        >
                          <div className={`h-4 w-4 rounded mr-2 ${system.previewColor}`} />
                          {system.name}
                        </DropdownMenuItem>
                      ))}

                      <DropdownMenuItem
                        onSelect={() => {
                          setSelectedDesign('Custom')
                          setShowDesignModal(true)
                          setShowMenu(false)
                        }}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4" />
                        New Design System
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* {designConfig && (
                <>
                  <div className="h-4 w-px bg-gray-300 mx-2" />
                  <Button
                    type="button"
                    className="h-7 w-7 p-0 rounded-md"
                    style={{ backgroundColor: designConfig.primaryColor }}
                    onClick={() => {
                      setShowMenu(true)
                      setMenuMode('design')
                    }}
                    variant="ghost"
                    size="sm"
                  />
                </>
              )} */}
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

          <div className="flex items-center gap-px">
            {!isListening && (
              <Button
                type="button"
                onClick={handleVoiceToggle}
                className="h-7 w-7 p-1.5 cursor-pointer text-sm rounded-md hover:bg-[#e7e7e7] text-black"
                title="Voice input"
                disabled={isLoading}
                variant="ghost"
                size="sm"
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}
            {showUpgradeButton ? (
              <Link href={'/pricing'}>
                <Button
                  type="button"
                  size="icon"
                  className="h-7 w-20 p-1.5 bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black"
                  disabled={isLoading}
                >
                  Upgrade
                </Button>
              </Link>
            ) : (
              <Button
                type={isListening ? "button" : "submit"}
                onClick={isListening ? stopVoiceInput : undefined}
                size="icon"
                className={`h-7 w-7 p-1.5 rounded-md mr-1 ${isListening ? "bg-red-500 hover:bg-red-600" : "bg-[rgba(40,40,40,0.65)] dark:bg-[#c1603cdc]"}`}
                disabled={
                  isLoading || (!isListening && ((!message.trim() && uploadedFiles.length === 0) || !isAuthenticated))
                }
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="primaryColor" className="text-right">
                Primary Color
              </Label>
              <Input
                id="primaryColor"
                type="color"
                value={tempConfig.primaryColor}
                onChange={(e) => setTempConfig({ ...tempConfig, primaryColor: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="secondaryColor" className="text-right">
                Secondary Color
              </Label>
              <Input
                id="secondaryColor"
                type="color"
                value={tempConfig.secondaryColor}
                onChange={(e) => setTempConfig({ ...tempConfig, secondaryColor: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="backgroundColor" className="text-right">
                Background Color
              </Label>
              <Input
                id="backgroundColor"
                type="color"
                value={tempConfig.backgroundColor}
                onChange={(e) => setTempConfig({ ...tempConfig, backgroundColor: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="textColor" className="text-right">
                Text Color
              </Label>
              <Input
                id="textColor"
                type="color"
                value={tempConfig.textColor}
                onChange={(e) => setTempConfig({ ...tempConfig, textColor: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="buttonStyle" className="text-right">
                Button Style
              </Label>
              <Select
                value={tempConfig.buttonStyle}
                onValueChange={(value) => setTempConfig({ ...tempConfig, buttonStyle: value as 'rounded' | 'square' | 'pill' })}
              >
                <SelectTrigger className="col-span-3" />
                <SelectContent>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="pill">Pill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="borderStyle" className="text-right">
                Border Style
              </Label>
              <Select
                value={tempConfig.borderStyle}
                onValueChange={(value) => setTempConfig({ ...tempConfig, borderStyle: value as 'solid' | 'dashed' | 'none' })}
              >
                <SelectTrigger className="col-span-3" />
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => {
              setDesignConfig(tempConfig)
              setShowDesignModal(false)
            }}
          >
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export function ChatInput(props: ChatInputProps) {
  return <ChatInputImpl {...props} />
}