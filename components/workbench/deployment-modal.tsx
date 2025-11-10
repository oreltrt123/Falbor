"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react"

interface DeploymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  existingDeployment?: {
    platform: "vercel" | "netlify"
    deploymentUrl: string
  } | null
}

export function DeploymentModal({ open, onOpenChange, projectId, existingDeployment }: DeploymentModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<"vercel" | "netlify" | null>(
    existingDeployment?.platform || null,
  )
  const [apiKey, setApiKey] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentUrl, setDeploymentUrl] = useState(existingDeployment?.deploymentUrl || "")
  const [error, setError] = useState("")

  const handleDeploy = async () => {
    if (!selectedPlatform || !apiKey) {
      setError("Please select a platform and enter your API key")
      return
    }

    setIsDeploying(true)
    setError("")

    try {
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          apiKey,
        }),
      })

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        // If JSON parsing fails, treat as server error
        console.error("JSON parse error:", jsonError)
        if (response.ok) {
          throw new Error("Invalid response from server")
        } else {
          throw new Error("Deployment failed (server error)")
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || "Deployment failed")
      }

      setDeploymentUrl(data.deploymentUrl)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#1E1E21] border-[#3A3A3E] text-white">
        <DialogHeader>
          <DialogTitle>Deploy Your Project</DialogTitle>
          <DialogDescription className="text-white/60">
            Choose a platform and deploy your website live
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {deploymentUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Deployed Successfully!</span>
              </div>
              <div className="p-3 bg-[#2A2A2E] rounded border border-[#3A3A3E]">
                <Label className="text-xs text-white/60 mb-1">Your website is live at:</Label>
                <a
                  href={deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 text-sm break-all"
                >
                  {deploymentUrl}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Platform</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedPlatform("vercel")}
                    className={`p-4 rounded border-2 transition-all ${
                      selectedPlatform === "vercel"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-[#3A3A3E] hover:border-[#4A4A4E]"
                    }`}
                  >
                    <div className="font-medium">Vercel</div>
                    <div className="text-xs text-white/60 mt-1">Deploy with Vercel</div>
                  </button>
                  <button
                    onClick={() => setSelectedPlatform("netlify")}
                    className={`p-4 rounded border-2 transition-all ${
                      selectedPlatform === "netlify"
                        ? "border-teal-500 bg-teal-500/10"
                        : "border-[#3A3A3E] hover:border-[#4A4A4E]"
                    }`}
                  >
                    <div className="font-medium">Netlify</div>
                    <div className="text-xs text-white/60 mt-1">Deploy with Netlify</div>
                  </button>
                </div>
              </div>

              {selectedPlatform && (
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{selectedPlatform === "vercel" ? "Vercel" : "Netlify"} API Token</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your API token"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-[#2A2A2E] border-[#3A3A3E] text-white"
                  />
                  <p className="text-xs text-white/50">
                    Get your token from your {selectedPlatform === "vercel" ? "Vercel" : "Netlify"} account settings
                  </p>
                </div>
              )}

              {error && <div className="text-sm text-red-400 bg-red-400/10 p-2 rounded">{error}</div>}

              <Button onClick={handleDeploy} disabled={!selectedPlatform || !apiKey || isDeploying} className="w-full">
                {isDeploying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  "Deploy Now"
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}