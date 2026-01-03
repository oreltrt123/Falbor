"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Save, Loader2 } from "lucide-react"
import { useAuth } from "@clerk/nextjs"
import { cn } from "@/lib/utils"

export function CustomKnowledgeSection() {
  const [promptName, setPromptName] = useState("")
  const [promptContent, setPromptContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const { getToken } = useAuth()

  useEffect(() => {
    loadCustomKnowledge()
  }, [])

  const loadCustomKnowledge = async () => {
    try {
      const token = await getToken()
      const response = await fetch("/api/custom-knowledge", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.knowledge) {
          setPromptName(data.knowledge.promptName || "")
          setPromptContent(data.knowledge.promptContent || "")
        }
      }
    } catch (error) {
      console.error("[v0] Failed to load custom knowledge:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!promptName.trim() || !promptContent.trim()) {
      setMessage({ type: "error", text: "Please fill in both fields" })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const token = await getToken()
      const response = await fetch("/api/custom-knowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptName,
          promptContent,
        }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: "Custom knowledge saved successfully!" })
        setTimeout(() => setMessage(null), 3000)
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      console.error("[v0] Failed to save custom knowledge:", error)
      setMessage({ type: "error", text: "Failed to save custom knowledge" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-black/50" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <h2 className="text-xl font-light text-black mb-2">Custom Knowledge</h2>
        <p className="text-sm text-black/60 mb-6">
          Define custom instructions that will be included in every AI generation. The AI will always remember and
          follow these preferences.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black/80 mb-2">Prompt Name</label>
            <Input
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
              placeholder="e.g., Design Preferences"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black/80 mb-2">Custom Instructions</label>
            <Textarea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder="e.g., Always use dark mode, prefer Tailwind CSS, create mobile-first designs..."
            />
          </div>

          <div className="flex items-center gap-3">
            <Button 
            onClick={handleSave} 
            disabled={saving}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 h-7 rounded transition-colors",
              saving? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-[#0099FF] text-white hover:bg-[#0099FF]",
            )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Knowledge
                </>
              )}
            </Button>

            {message && (
              <span className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {message.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
