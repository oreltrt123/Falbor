"use client"

import Link from "next/link"
import { useUser, useClerk, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"
import { Download, Share2, Copy, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavbarProps {
  projectId: string
  handleDownload: () => void
}

interface Collaborator {
  userId: string
  imageUrl: string
  name: string
}

export function Navbar({ projectId, handleDownload }: NavbarProps) {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const clerk = useClerk()

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Share states
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState<boolean | null>(null)
  const [generating, setGenerating] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  // Collaborators
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareToken}`
      : null

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Load project + share + collaborators
  useEffect(() => {
    if (!isLoaded || !user || !projectId) return

    const loadData = async () => {
      try {
        const token = await getToken()

        // 1. Project
        const projectRes = await fetch(`/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (projectRes.ok) {
          const data = await projectRes.json()
          setIsPublic(data.isPublic ?? false)
        }

        // 2. Share token
        const shareRes = await fetch(`/api/projects/${projectId}/share`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (shareRes.ok) {
          const data = await shareRes.json()
          if (data.shareToken) setShareToken(data.shareToken)
        }

        // 3. Collaborators
        const collabRes = await fetch(`/api/projects/${projectId}/collaborators`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (collabRes.ok) {
          const data = await collabRes.json()
          setCollaborators(data.collaborators || [])
        }
      } catch (err) {
        console.error("Failed to load navbar data:", err)
      }
    }

    loadData()
  }, [isLoaded, user, projectId, getToken])

  // Create share link
  const createShareLink = async () => {
    if (generating) return
    setGenerating(true)
    setShareError(null)

    try {
      const token = await getToken()

      if (isPublic === false) {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isPublic: true }),
        })
        setIsPublic(true)
      }

      const postRes = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await postRes.json()
      setShareToken(data.shareToken)
    } catch (err: any) {
      setShareError(err.message || "Failed to create share link")
    } finally {
      setGenerating(false)
    }
  }

  const copyShare = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  // Avatar stacking logic
  const displayed = collaborators.slice(0, 3)
  const extraCount = collaborators.length - 3

  if (!user) {
    return null
  }

  return (
    <nav className="z-50 fixed w-full bg-black/80 backdrop-blur-sm border-b border-white/10">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">

        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img width={140} src="/logo_light.png" alt="Logo" />
        </Link>

        <div className="flex items-center gap-4">

          {/* Download */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="border-white/20 hover:bg-white/10 text-white"
          >
            <Download size={16} className="mr-2" />
            Download
          </Button>

          {/* Share */}
          <div className="relative" ref={shareRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShareOpen(v => !v)
                if (!shareToken && !generating) createShareLink()
              }}
              className="border-white/20 hover:bg-white/10 text-white"
            >
              <Share2 size={16} className="mr-2" />
              Share
            </Button>

            {shareOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-5 z-50">
                <h3 className="text-white font-medium mb-4">Share Project</h3>

                {generating ? (
                  <div className="flex items-center justify-center py-8 text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-3" />
                    Generating link...
                  </div>
                ) : shareUrl ? (
                  <>
                    <div className="flex gap-2 mb-4">
                      <input
                        readOnly
                        value={shareUrl}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
                      />
                      <Button size="icon" variant="ghost" onClick={copyShare}>
                        {shareCopied ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <Copy className="h-5 w-5 text-zinc-400" />
                        )}
                      </Button>
                    </div>

                    <p className="text-xs text-zinc-500">
                      Anyone with this link can collaborate on this project.
                    </p>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Collaborator Avatars */}
          <div className="flex items-center relative">
            {displayed.map((c, i) => (
              <div
                key={c.userId}
                className="w-9 h-9 rounded-full border-2 border-black overflow-hidden"
                style={{ marginLeft: i === 0 ? 0 : -3, zIndex: 10 - i }}
              >
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}

            {extraCount > 0 && (
              <div
                className="w-9 h-9 rounded-full bg-zinc-700 text-white text-xs flex items-center justify-center border-2 border-black"
                style={{ marginLeft: -3 }}
              >
                +{extraCount}
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-zinc-700"
            >
              <img
                src={user.imageUrl || "/default-avatar.png"}
                alt="User avatar"
                className="w-full h-full object-cover"
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
                <div className="p-4 border-b border-zinc-800">
                  <p className="text-white font-medium">{user.firstName || user.username}</p>
                  <p className="text-xs text-zinc-500">
                    {user.emailAddresses?.[0]?.emailAddress}
                  </p>
                </div>

                <div className="py-2">
                  <Link href="/projects">
                    <button className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800">
                      Projects
                    </button>
                  </Link>

                  <button
                    onClick={() => clerk.openUserProfile()}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    Manage Account
                  </button>

                  <button
                    onClick={() => clerk.signOut()}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-800"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  )
}
