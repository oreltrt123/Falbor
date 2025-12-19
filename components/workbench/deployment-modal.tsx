"use client"

import { useState, useRef, useEffect } from "react"
import { X, Loader } from "lucide-react"
import { cn } from "@/lib/utils"

interface DeploymentModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onSuccess?: (deployment: any) => void
}

type Platform = "whatsapp" | "discord" | null

export function DeploymentModal({ isOpen, onClose, projectId, onSuccess }: DeploymentModalProps) {
  const [step, setStep] = useState<"select" | "token">("select")
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(null)
  const [token, setToken] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [error, setError] = useState("")
  const modalRef = useRef<HTMLDivElement>(null)

  const effectiveProjectId = projectId || `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  useEffect(() => {
    if (!isOpen) {
      setStep("select")
      setSelectedPlatform(null)
      setToken("")
      setError("")
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  const handlePlatformSelect = (platform: Platform) => {
    setSelectedPlatform(platform)
    setStep("token")
    setError("")
  }

  const handleDeploy = async () => {
    if (!token.trim()) {
      setError("Please enter a valid token")
      return
    }

    if (!selectedPlatform) {
      setError("No platform selected")
      return
    }

    setIsDeploying(true)
    setError("")

    try {
      console.log("[v0] Deploying to", selectedPlatform, "with projectId:", effectiveProjectId)

      const response = await fetch(`/api/projects/${effectiveProjectId}/deploy-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          apiToken: token,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || "Deployment failed")
      }

      console.log("[v0] Bot deployed successfully:", data)

      if (onSuccess) {
        onSuccess(data)
      }

      // Show success message
      alert(`Your bot is now live on ${selectedPlatform === "whatsapp" ? "WhatsApp" : "Discord"}!`)

      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(errorMessage)
      console.error("[v0] Deployment error:", err)
    } finally {
      setIsDeploying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg p-6 w-96 max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Deploy Bot to Platform</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" disabled={isDeploying}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === "select" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">Choose a platform to deploy your bot:</p>

              {/* Platform Options */}
              <button
                onClick={() => handlePlatformSelect("whatsapp")}
                disabled={isDeploying}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
                  selectedPlatform === "whatsapp"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl">💬</div>
                  <div>
                    <p className="font-semibold text-gray-900">WhatsApp</p>
                    <p className="text-xs text-gray-500">Deploy via WhatsApp Business API</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handlePlatformSelect("discord")}
                disabled={isDeploying}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
                  selectedPlatform === "discord"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">🎮</div>
                  <div>
                    <p className="font-semibold text-gray-900">Discord</p>
                    <p className="text-xs text-gray-500">Deploy as a Discord Bot</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {selectedPlatform === "whatsapp" ? "WhatsApp Business API Token" : "Discord Bot Token"}
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={
                    selectedPlatform === "whatsapp" ? "Enter your WhatsApp API token" : "Enter your Discord bot token"
                  }
                  disabled={isDeploying}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {selectedPlatform === "whatsapp"
                    ? "Get this from your WhatsApp Business account settings"
                    : "Get this from Discord Developer Portal → Applications → Your Bot → Token"}
                </p>
              </div>

              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <button
            onClick={() => {
              if (step === "token") {
                setStep("select")
              } else {
                onClose()
              }
            }}
            disabled={isDeploying}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {step === "token" ? "Back" : "Cancel"}
          </button>

          {step === "token" && (
            <button
              onClick={handleDeploy}
              disabled={isDeploying || !token.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
            >
              {isDeploying && <Loader className="w-4 h-4 animate-spin" />}
              {isDeploying ? "Deploying..." : "Deploy"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
