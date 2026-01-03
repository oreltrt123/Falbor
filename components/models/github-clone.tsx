"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Github, Loader2, X, HelpCircle } from "lucide-react"
import { useUser } from "@clerk/nextjs"

interface CreditsData {
  subscriptionTier: string
}

export function GithubClone() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)

  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [subError, setSubError] = useState("")

  const router = useRouter()
  const { user, isLoaded } = useUser()

  const fetchCredits = async () => {
    if (!user?.id) return
    try {
      const res = await fetch("/api/user/credits")
      if (!res.ok) throw new Error("Failed to fetch credits")
      const data: CreditsData = await res.json()
      setCreditsData(data)
    } catch (err) {
      console.error(err)
      setSubError("Failed to load subscription information")
    }
  }

  // Load credits early (for button + dialog)
  useEffect(() => {
    if (isLoaded && user?.id && !creditsData) {
      fetchCredits()
    }
  }, [isLoaded, user?.id])

  // Optional refresh when dialog opens
  useEffect(() => {
    if (open && isLoaded && user?.id) {
      setLoadingCredits(true)
      setSubError("")
      fetchCredits().finally(() => setLoadingCredits(false))
    }
  }, [open, isLoaded, user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || isLoading) return

    setError("")
    setIsLoading(true)

    try {
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
      if (!match) {
        setError("Invalid GitHub URL")
        return
      }

      const [, owner, repo] = match
      const cleanRepo = repo.replace(/\.git$/, "")

      const res = await fetch("/api/github/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo: cleanRepo, githubUrl: url }),
      })

      if (!res.ok) throw new Error("Clone failed")

      const { projectId } = await res.json()
      router.push(`/chat/${projectId}`)
    } catch (err) {
      setError("Failed to clone repository")
    } finally {
      setIsLoading(false)
    }
  }

  const hasSubscription = creditsData?.subscriptionTier !== "none"

  return (
    <div>
      {/* MAIN BUTTON */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border h-8 cursor-pointer border-[#dbd9d965] rounded-full bg-white text-black px-3 py-2 flex items-center justify-between hover:border-[#c1603c56]"
      >
        <span className="flex items-center gap-2">
          <Github className="w-4 h-4" />
          <span className="text-sm font-light">Clone from GitHub</span>
        </span>

        {!hasSubscription && (
          <span className="flex items-center gap-1 text-xs font-medium bg-[#c15f3c] ml-2 text-white px-2 py-0.5 rounded-full">
            Pro
          </span>
        )}
      </button>

      {/* DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-[#ffffff] border border-[#ececec50] p-1">
          <DialogTitle className="sr-only">Clone GitHub Repository</DialogTitle>

          <DialogClose className="absolute top-4 right-4 text-black/70 hover:text-black z-10">
            <X className="w-5 h-5" />
          </DialogClose>

          {/* HEADER — ONLY FOR SUBSCRIBED USERS */}
          {hasSubscription && (
            <div className="bg-gradient-to-r rounded-md from-[#c15f3c] via-[#b69d95] to-[#c15f3c] h-32 flex items-center justify-center">
              <Github className="w-16 h-16 text-white" />
            </div>
          )}

          <div className="">
            {/* TITLE — ONLY FOR SUBSCRIBED USERS */}
            {hasSubscription && (
              <div className="text-center">
                <p className="text-black">
                  Clone a GitHub repository using just a URL
                </p>
                <p className="text-black/70 text-sm mt-[-10px]">
                  Turn your repo into a live web app instantly
                </p>
              </div>
            )}

            {loadingCredits ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-black/70" />
            ) : !hasSubscription ? (
              /* 🔒 NO SUBSCRIPTION VIEW */
              <div className="text-center space-y-2 px-3 py-3">
                <p className="text-black">
                  You don’t have a subscription 
                </p>
                <p className="text-black/70 text-sm mt-[-14px]">
                  Upgrade to unlock GitHub cloning
                </p>
                <Button
                  className="w-full bg-[#c15f3c] hover:bg-[#c1603cdc]"
                  onClick={() => {
                    setOpen(false)
                    router.push("/pricing")
                  }}
                >
                  Go to Pricing
                </Button>
              </div>
            ) : (
              /* ✅ FULL GITHUB CLONE UI */
              <form onSubmit={handleSubmit} className="space-y-4 px-3 py-3">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste GitHub repository URL"
                  disabled={isLoading}
                  className="bg-[#ececec] border-[#ececec] text-white"
                />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading || !url.trim()}
                  className="w-full bg-[#c15f3c] hover:bg-[#c1603cdc] text-white py-2 rounded-md"
                >
                  {isLoading ? "Cloning..." : "Clone Repository into Falbor"}
                </button>
                <div className="flex gap-2 text-xs text-black/50">
                  <HelpCircle className="w-3 h-3 mt-0.5" />
                  Copy the URL from the GitHub address bar
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
