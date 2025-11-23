"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader, Eye, EyeOff, Check, Loader2 } from "lucide-react"
import { Badge } from "../ui/badge"

type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss" | "runware"

interface ModelConfig {
  id: ModelType
  label: string
  icon: string
  description: string
}

const models: ModelConfig[] = [
  { id: "gemini", label: "Gemini 3 Pro", icon: "/icons/gemini.png", description: "Google's advanced AI model" },
  {
    id: "claude",
    label: "Claude Sonnet 4.5",
    icon: "/icons/claude.png",
    description: "Anthropic's intelligent assistant",
  },
  { id: "gpt", label: "GPT-5", icon: "/icons/openai.png", description: "OpenAI's latest model" },
  { id: "deepseek", label: "Deepseek R3", icon: "/icons/deepseek.png", description: "Deepseek's reasoning model" },
  { id: "gptoss", label: "GPT-OSS 20B", icon: "/icons/openai.png", description: "Open source model" },
  { id: "runware", label: "Runware AI Images", icon: "/icons/runware.png", description: "AI image generation" },
]

interface UserModelConfig {
  enabledModels: string[]
  modelApiKeys: Record<string, string>
}

export function AIModelsSection() {
  const { user } = useUser()
  const [config, setConfig] = useState<UserModelConfig>({
    enabledModels: models.map((m) => m.id),
    modelApiKeys: {},
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showApiInput, setShowApiInput] = useState<ModelType | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [visibleApiKey, setVisibleApiKey] = useState<ModelType | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchModelConfig()
    }
  }, [user?.id])

  const fetchModelConfig = async () => {
    try {
      const response = await fetch("/api/user/model-config")
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch model config:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleModel = async (modelId: ModelType) => {
    const newEnabled = config.enabledModels.includes(modelId)
      ? config.enabledModels.filter((m) => m !== modelId)
      : [...config.enabledModels, modelId]

    const updatedConfig = { ...config, enabledModels: newEnabled }
    setConfig(updatedConfig)
    await saveModelConfig(updatedConfig)
  }

  const handleAddApiKey = async (modelId: ModelType) => {
    if (!apiKeyInput.trim()) return

    const updatedConfig = {
      ...config,
      modelApiKeys: { ...config.modelApiKeys, [modelId]: apiKeyInput },
      enabledModels: config.enabledModels.includes(modelId) ? config.enabledModels : [...config.enabledModels, modelId],
    }

    setConfig(updatedConfig)
    await saveModelConfig(updatedConfig)
    setApiKeyInput("")
    setShowApiInput(null)

    // Add 4 credits for new API key
    await fetch("/api/user/add-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 4, reason: "added_api_key", model: modelId }),
    })
  }

  const handleRemoveApiKey = async (modelId: ModelType) => {
    const updatedKeys = { ...config.modelApiKeys }
    delete updatedKeys[modelId]

    const updatedConfig = { ...config, modelApiKeys: updatedKeys }
    setConfig(updatedConfig)
    await saveModelConfig(updatedConfig)
  }

  const saveModelConfig = async (newConfig: UserModelConfig) => {
    setIsSaving(true)
    try {
      await fetch("/api/user/model-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      })
    } catch (error) {
      console.error("[v0] Failed to save model config:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 overflow-auto p-6 justify-center items-center w-full">
        <Loader2 className="w-6 h-6 animate-spin text-[#0099FF]" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-1 overflow-auto p-6 justify-center items-center w-full">
        <div className="max-w-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-light text-black mb-2">AI Models</h2>
            <p className="text-sm text-black/60">
              Enable or disable AI models. Add your own API keys to unlock additional credits and use custom
              configurations.
            </p>
          </div>

          <div className="space-y-3">
            {models.map((model) => {
              const isEnabled = config.enabledModels.includes(model.id)
              const hasApiKey = !!config.modelApiKeys[model.id]

              return (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-[#e0e0e0] hover:border-[#0099FF] transition-colors bg-white"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <img src={model.icon || "/placeholder.svg"} alt={model.label} className="w-8 h-8 rounded" />
                    <div>
                      <h3 className="text-sm font-medium text-black">{model.label}</h3>
                      <p className="text-xs text-black/50">{model.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasApiKey && <Check className="w-4 h-4 text-green-500" />}

                    {showApiInput === model.id ? (
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Enter API key"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          className="px-2 py-1 w-full bg-[#e4e4e4b4] placeholder:text-black border-none shadow-none rounded-md text-black text-sm focus:border-none focus:outline-none"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddApiKey(model.id)}
                          disabled={!apiKeyInput.trim()}
                          className="bg-[#e4e4e4b4] hover:bg-[#5b8dc536] text-black h-7"
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowApiInput(null)
                            setApiKeyInput("")
                          }}
                          className="h-7 shadow-none hover:border-white hover:bg-[#e4e4e4b4]"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : hasApiKey ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setVisibleApiKey(visibleApiKey === model.id ? null : model.id)}
                          className="p-1 hover:bg-[#f0f0f0] rounded"
                        >
                          {visibleApiKey === model.id ? (
                            <EyeOff className="w-4 h-4 text-black/50" />
                          ) : (
                            <Eye className="w-4 h-4 text-black/50" />
                          )}
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowApiInput(model.id)}
                          className="h-7 text-xs"
                        >
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveApiKey(model.id)}
                          className="h-7 text-xs"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              // onClick={() => setShowApiInput(model.id)}
                              className="bg-[#ffffffb4] opacity-50 border border-[#e4e4e4b4] hover:bg-white text-black h-7 text-xs" //hover:bg-[#5b8dc536]
                            >
                              Add API Key <Badge className="bg-[#e4e4e4b4] mr-[-10px] text-black">Coming soon</Badge>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs bg-black text-white w-40">
                            This feature is coming soon! Add your API key to unlock more credits and custom configurations.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}

                    <button
                      onClick={() => toggleModel(model.id)}
                      className={`ml-2 w-10 h-6 rounded-full transition-colors ${
                        isEnabled ? "bg-[#0099FF]" : "bg-[#d6d6d6]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          isEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}