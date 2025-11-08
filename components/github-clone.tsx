"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Github, Loader2 } from "lucide-react"

export function GithubClone() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || isLoading) return

    setError("")
    setIsLoading(true)

    try {
      // Parse GitHub URL to extract owner and repo
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
      if (!match) {
        setError("Invalid GitHub URL. Please use format: https://github.com/owner/repo")
        setIsLoading(false)
        return
      }

      const [, owner, repo] = match
      const cleanRepo = repo.replace(/\.git$/, "")

      // Call API to clone repository
      const res = await fetch("/api/github/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo: cleanRepo, githubUrl: url }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to clone repository")
      }

      const { projectId } = await res.json()

      // Navigate to the new chat with cloned repository
      router.push(`/chat/${projectId}`)
    } catch (err) {
      console.error("[GithubClone] Error:", err)
      setError(err instanceof Error ? err.message : "Failed to clone repository")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative bg-[#1b1b1b] border border-[#272727] rounded-md overflow-hidden hover:border-[#3b3b3fbe] transition-colors">
          <div className="flex items-center gap-2 px-3 py-3">
            <Github className="w-5 h-5 text-white/50 flex-shrink-0" />
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste GitHub repository URL (e.g., https://github.com/vercel/next.js)"
              className="flex-1 bg-transparent border-none text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!url.trim() || isLoading}
              className="bg-[#2f2f30] hover:bg-[#3f3f40] text-white flex-shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cloning...
                </>
              ) : (
                "Clone Repository"
              )}
            </Button>
          </div>
        </div>
      </form>
      {error && <p className="text-sm text-red-500 mt-2 px-1">{error}</p>}
    </div>
  )
}
