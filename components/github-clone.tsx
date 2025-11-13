"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Github, Loader2, X, HelpCircle } from "lucide-react"

export function GithubClone() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
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
    <div className="w-[29%]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium cursor-pointer w-full py-1 p-2 border border-[#44444450] hover:border-[#ff8c001f] rounded-4xl bg-[#272727a6] text-[#e9e9e9] flex items-center gap-2"
      >
        <Github className="w-4 h-4" />
        Clone from GitHub
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-[#1b1b1b] border border-[#44444450] p-0 max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Clone GitHub Repository</DialogTitle>
          <div className="relative">
            <DialogClose className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
              <X className="w-5 h-5" />
            </DialogClose>
            {/* Colorful top section */}
            <div className="relative bg-gradient-to from-purple-600 via-pink-600 to-blue-600 h-32 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-black/20" />
              <Github className="w-16 h-16 text-white drop-shadow-lg relative z-10" />
            </div>
            {/* Content */}
            <div className="px-6 pb-6 pt-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Clone GitHub Repository</h2>
                <p className="text-sm text-white/70">Turn your repo into a live web app. Generate, preview and edit code instantly.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste GitHub repository URL here"
                    className="w-full bg-[#2a2a2a] border border-[#44444450] rounded-lg text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3"
                    disabled={isLoading}
                  />
                  <div className="flex items-start gap-2 text-xs text-white/50">
                    <HelpCircle className="w-3 h-3 mt-0.5" />
                    <span className="leading-relaxed">How to get a GitHub repo URL? Right click on a repo &gt; Copy the URL from address bar</span>
                  </div>
                </div>
                {error && <p className="text-sm text-red-500 px-1">{error}</p>}
                <button
                  type="submit"
                  disabled={!url.trim() || isLoading}
                  className="text-sm font-medium cursor-pointer w-full py-1 p-2 hover:border-[#ff8c001f] rounded-md bg-[#2b2b2b] border border-[#44444450] text-[#e9e9e9] flex items-center gap-2"
                >
                  <span className="justify-between text-center w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cloning...
                    </>
                  ) : (
                    "Clone Repository into Falbor"
                  )}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}