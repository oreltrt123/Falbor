// File: components/MainHeader.tsx
// Changes: Replaced the custom /api/auth/token fetch with useAuth().getToken() for consistency with other components.
// This should resolve the "Unauthorized" error by ensuring a valid Clerk JWT is sent in the Authorization header.
"use client"

import { Globe, Code2, Download, RefreshCw, Rocket, Settings, Terminal, Database } from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useAuth } from "@clerk/nextjs"

interface MainHeaderProps {
  showDownloadMenu: boolean
  setShowDownloadMenu: (open: boolean) => void
  handleDownload: () => void
  refreshFilesAndPreview: () => void
  projectId: string
}

export function MainHeader({
  handleDownload,
  refreshFilesAndPreview,
  projectId,
}: MainHeaderProps) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [, setDeployedUrl] = useState<string | null>(null)
  const { getToken } = useAuth()

  const handleDeploy = async () => {
    setIsDeploying(true)
    try {
      const token = await getToken()

      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Deployment failed")
      }

      const data = await response.json()
      setDeployedUrl(data.deploymentUrl)

      window.open(data.deploymentUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      console.error("[v0] Deployment error:", error)
      alert(`Failed to deploy: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="p-3 flex items-center justify-between">
      {/* Left side - Tab Navigation */}
      <div className="flex items-center gap-2">
        <TabsList className="w-[100%] justify-start">
          <TabsTrigger value="preview" className="gap-2">
            <Globe className="w-4 h-4 text-black" />
          </TabsTrigger>
          <TabsTrigger value="code" className="gap-2">
            <Code2 className="w-4 h-4 text-black" />
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4 text-black" />
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2">
            <Database className="w-4 h-4 text-black" />
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Right side - Deploy and Download buttons */}
      <div className="relative flex items-center gap-2">
        <button
          onClick={handleDeploy}
          disabled={isDeploying}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
            isDeploying ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black",
          )}
          title="Deploy to production"
        >
          <Rocket className="w-4 h-4" />
          {isDeploying ? "Deploying..." : "Deploy"}
        </button>
        {/* Download button */}
        <button
          id="download-button"
          onClick={handleDownload}
          className="flex items-center gap-1 text-xs text-black/80 hover:underline p-1 rounded"
          title="Download project as ZIP"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}