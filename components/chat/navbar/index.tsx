// Your Navbar component file (e.g., components/Navbar.tsx)
// I've added the auth token to the fetch call for consistency and security.
// I've also added a console.log for debugging the URL and projectId.
// No other changes needed here— the error is NOT from this file.
// The error comes from the API route not being set up correctly as dynamic.

"use client" // <- Important! Must be at the top of the file

import Link from "next/link"
import { useUser, useClerk, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"
import {
  Globe,
  Code2,
  Download,
  Settings,
  Database,
  Copy,
  ExternalLink,
  Check,
  Share2,
  Github,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { formatDistanceToNow } from "date-fns"

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
}

interface DeploymentData {
  deploymentUrl: string
  updatedAt: string
}

interface NavbarProps {
  projectId: string
  handleDownload: () => void
}

// 🔑 Toggle this when the database section is ready
const DATABASE_ENABLED = false

export function Navbar({ projectId, handleDownload }: NavbarProps) {
  const { user, isLoaded } = useUser()
  const clerk = useClerk()
  const { getToken } = useAuth()

  // Single dropdown state
  type OpenDropdown = "profile" | "publish" | "share" | "github" | null
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const publishDropdownRef = useRef<HTMLDivElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)
  const githubRef = useRef<HTMLDivElement>(null)

  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [isPublishing, setIsPublishing] = useState(false)
  const [deployment, setDeployment] = useState<DeploymentData | null>(null)
  const [copied, setCopied] = useState(false)

  const [isPublic, setIsPublic] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [shareCopied, setShareCopied] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)

  // GitHub states
  const [isGithubConnected, setIsGithubConnected] = useState(false)
  const [githubRepos, setGithubRepos] = useState<string[]>([])
  const [newRepoName, setNewRepoName] = useState("")
  const [isPushing, setIsPushing] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)

  // Close any dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !dropdownRef.current?.contains(event.target as Node) &&
        !publishDropdownRef.current?.contains(event.target as Node) &&
        !shareRef.current?.contains(event.target as Node) &&
        !githubRef.current?.contains(event.target as Node)
      ) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch credits + timer
  useEffect(() => {
    if (!isLoaded || !user?.id) return

    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/user/credits")
        if (res.ok) {
          const data: CreditsData = await res.json()
          setCreditsData(data)
          setTimeLeft(data.secondsUntilNextRegen)
        }
      } catch (err) {
        console.error("Failed to fetch credits:", err)
      }
    }

    fetchCredits()

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
  }, [isLoaded, user?.id])

  // Fetch deployment status
  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        const token = await getToken()
        const response = await fetch(`/api/projects/${projectId}/deployment`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          if (data.deploymentUrl && data.updatedAt) {
            setDeployment({
              deploymentUrl: data.deploymentUrl,
              updatedAt: data.updatedAt,
            })
          }
        }
      } catch (error) {
        console.error("[Navbar] Error fetching deployment:", error)
      }
    }

    fetchDeployment()
  }, [projectId, getToken])

  // Fetch project sharing settings
  useEffect(() => {
    const fetchProjectSettings = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setIsPublic(data.isPublic || false)
        }
      } catch (err) {
        console.error("[Navbar] Failed to fetch project settings:", err)
      }
    }

    fetchProjectSettings()
  }, [projectId])

  // Fetch GitHub connection status and repos
  useEffect(() => {
    if (!isLoaded || !user?.id) return

    const fetchGithubStatus = async () => {
      try {
        const res = await fetch("/api/github/status")
        if (res.ok) {
          const { connected } = await res.json()
          setIsGithubConnected(connected)
          if (connected) {
            const reposRes = await fetch("/api/github/repos")
            if (reposRes.ok) {
              const { repos } = await reposRes.json()
              setGithubRepos(repos.map((r: { name: string }) => r.name))
            }
          }
        }
      } catch (err) {
        console.error("[Navbar] Failed to fetch GitHub status:", err)
      }
    }

    fetchGithubStatus()
  }, [isLoaded, user?.id])

  // Publish
  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const token = await getToken()
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error("Deployment failed")

      const data = await response.json()
      setDeployment({
        deploymentUrl: data.deploymentUrl,
        updatedAt: new Date().toISOString(),
      })

      window.open(data.deploymentUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      alert(`Failed to deploy: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCopyDeploymentUrl = async () => {
    if (deployment?.deploymentUrl) {
      await navigator.clipboard.writeText(deployment.deploymentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Sharing feature handlers
  const generateShareUrl = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        const url = `${window.location.origin}/share/${data.shareToken}`
        setShareUrl(url)
        return url
      }
    } catch (err) {
      console.error("[Navbar] Failed to generate share URL:", err)
    }
    return ""
  }

  const handlePublicToggle = async (checked: boolean) => {
    setShareLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: checked }),
      })

      if (res.ok) {
        setIsPublic(checked)
        if (checked) {
          const url = await generateShareUrl()
          if (url) setShareUrl(url)
        }
      }
    } catch (err) {
      console.error("[Navbar] Failed to update project privacy:", err)
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareLink = async () => {
    let url = shareUrl
    if (!url) {
      url = await generateShareUrl()
      if (!url) return
    }

    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  // GitHub handlers
  const handleConnectGithub = () => {
    const currentPath = `/projects/${projectId}` // Adjust based on your actual route
    window.location.href = `/api/github/connect?redirectTo=${encodeURIComponent(currentPath)}`
  }

  const handlePushToGithub = async () => {
    if (!newRepoName) {
      setGithubError("Enter a repo name")
      return
    }
    if (!projectId) {
      setGithubError("No project ID available - cannot push")
      return
    }
    setIsPushing(true)
    setGithubError(null)
    try {
      // Debug: Check what URL we're actually fetching
      const pushUrl = `/api/projects/${projectId}/github/push`
      console.log('Pushing to GitHub with URL:', pushUrl)
      console.log('Project ID:', projectId)

      const token = await getToken() // Added for auth consistency

      const res = await fetch(pushUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` // Added this
        },
        body: JSON.stringify({ repoName: newRepoName }),
      })
      if (res.ok) {
        const { repoUrl } = await res.json()
        // Optionally update projects.githubUrl via another API call if needed
        alert(`Pushed to ${repoUrl}`)
        setNewRepoName("")
      } else {
        const { error } = await res.json()
        setGithubError(error)
      }
    } catch (err) {
      setGithubError("Failed to push to GitHub")
    } finally {
      setIsPushing(false)
    }
  }

  return (
    <nav className="z-50 fixed w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-sans font-light text-white absolute left-8">
          <img width={140} className="relative top-[-1px]" src="/logo_light.png" alt="Logo" />
        </Link>

        <div className="flex items-center gap-2 absolute right-3">
          {user ? (
            <>
              {/* Download */}
              <button
                onClick={handleDownload}
                className={cn(
                  "flex items-center gap-1 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer",
                  "bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black"
                )}
                title="Download project as ZIP"
              >
                Download
              </button>

              {/* Share Button */}
              <div className="relative" ref={shareRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "share" ? null : "share")}
                  className={cn(
                    "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer",
                    "bg-[#2b2525] hover:bg-[#3a3434] text-white"
                  )}
                >
                  <Share2 size={16} />
                  Share
                </button>

                {openDropdown === "share" && (
                  <div className="absolute top-full right-0 mt-[-10px] w-80 bg-[#e4e4e4] border rounded-lg z-50 p-4">
                    <h3 className="font-semibold text-base mb-4">Share Project</h3>

                    <div className="space-y-5">
                      {/* Public toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Make Public</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Allow others to view & request collaboration
                          </p>
                        </div>
                        <Switch
                          checked={isPublic}
                          onCheckedChange={handlePublicToggle}
                          disabled={shareLoading}
                        />
                      </div>

                      {/* Share link section */}
                      {isPublic && (
                        <div className="pt-3 border-t">
                          <p className="text-sm font-medium mb-2">Share Link</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={shareUrl || (shareLoading ? "Generating..." : "Click to generate")}
                              readOnly
                              className="flex-1 px-3 py-2 text-sm border rounded bg-gray-50 focus:outline-none"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={handleCopyShareLink}
                              disabled={!shareUrl && !shareLoading}
                            >
                              {shareCopied ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Anyone with this link can see the project and request access
                          </p>
                        </div>
                      )}

                      {!isPublic && (
                        <p className="text-xs text-gray-500 pt-3 border-t">
                          Turn on public sharing to generate a collaboration link
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Publish Button */}
              <div className="relative" ref={publishDropdownRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "publish" ? null : "publish")}
                  className={cn(
                    "flex items-center gap-1 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer",
                    isPublishing
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-[#2b2525] hover:bg-[#3a3434] text-white"
                  )}
                  disabled={isPublishing}
                >
                  {isPublishing ? "Publishing..." : "Publish"}
                </button>

                {openDropdown === "publish" && (
                  <div className="absolute top-full right-0 mt-[-10px] w-80 bg-[#e4e4e4] border rounded-lg z-50 overflow-hidden">
                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-gray-900 mb-3">Publish Your Site</h3>

                      {/* Deployment URL */}
                      <div className="mb-4">
                        <label className="text-xs text-gray-500 mb-1.5 block">Site URL</label>
                        {deployment?.deploymentUrl ? (
                          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded border">
                            <a
                              href={deployment.deploymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline truncate flex-1"
                            >
                              {deployment.deploymentUrl}
                            </a>
                            <button
                              onClick={handleCopyDeploymentUrl}
                              className="p-1.5 hover:bg-gray-200 rounded"
                              title="Copy URL"
                            >
                              {copied ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                            <a
                              href={deployment.deploymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-200 rounded"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-4 h-4 text-gray-600" />
                            </a>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 rounded border border-dashed text-center text-sm text-gray-400">
                            Not deployed yet
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="w-full"
                        size="sm"
                      >
                        {isPublishing
                          ? "Publishing..."
                          : deployment
                          ? "Update Deployment"
                          : "Publish Now"}
                      </Button>

                      {deployment?.updatedAt && (
                        <p className="text-xs text-gray-500 mt-4 text-center">
                          Last updated {formatDistanceToNow(new Date(deployment.updatedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* GitHub Button */}
              <div className="relative" ref={githubRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "github" ? null : "github")}
                  className={cn(
                    "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer",
                    "bg-[#2b2525] hover:bg-[#3a3434] text-white"
                  )}
                >
                  <Github size={16} />
                  GitHub
                </button>

                {openDropdown === "github" && (
                  <div className="absolute top-full right-0 mt-[-10px] w-80 bg-[#e4e4e4] border rounded-lg z-50 p-4">
                    <h3 className="font-semibold text-base mb-4">GitHub Integration</h3>

                    {!isGithubConnected ? (
                      <div>
                        <p className="text-sm text-gray-600 mb-4">Connect your GitHub account to push projects.</p>
                        <Button onClick={handleConnectGithub} className="w-full">
                          Connect GitHub
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Your Repos</p>
                          <ul className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
                            {githubRepos.length > 0 ? (
                              githubRepos.map((repo) => (
                                <li key={repo} className="text-sm text-gray-700 py-1">
                                  {repo}
                                </li>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500">No repos found</p>
                            )}
                          </ul>
                        </div>

                        <div className="pt-3 border-t">
                          <p className="text-sm font-medium mb-2">Push to New Repo</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder="New repo name"
                              value={newRepoName}
                              onChange={(e) => setNewRepoName(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              onClick={handlePushToGithub}
                              disabled={isPushing || !newRepoName}
                              size="sm"
                            >
                              {isPushing ? "Pushing..." : "Push"}
                            </Button>
                          </div>
                          {githubError && <p className="text-xs text-red-500 mt-2">{githubError}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile */}
              <button
                onClick={() => setOpenDropdown(openDropdown === "profile" ? null : "profile")}
                className="w-8 h-8 rounded-full overflow-hidden focus:outline-none cursor-pointer"
              >
                <img
                  src={user.imageUrl}
                  alt={user.firstName || "User"}
                  className="w-full h-full object-cover"
                />
              </button>

              {/* Profile Dropdown */}
              {openDropdown === "profile" && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full right-0 mt-[-10px] w-60 bg-[#e4e4e4] border rounded-lg z-50 transition-all duration-200"
                >
                  <div className="flex flex-col p-1.5">
                    {creditsData && (
                      <div className="hover:bg-gray-50 rounded-sm p-1 cursor-pointer flex items-center gap-3 w-full text-sm px-2 py-2.5 text-gray-200">
                        Next credits in{" "}
                        <span className="font-mono">
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    )}

                    <Link href="/projects" className="hover:bg-gray-50 rounded-sm p-1 cursor-pointer">
                      <button className="flex items-center gap-3 cursor-pointer w-full text-sm px-2 py-2.5 hover:bg-[#2e2e2e] text-gray-200 rounded">
                        Projects
                      </button>
                    </Link>

                    <Link href="/legal/privacy" className="hover:bg-gray-50 rounded-sm p-1 cursor-pointer">
                      <button className="flex items-center gap-3 w-full cursor-pointer text-sm px-2 py-2.5 hover:bg-[#2e2e2e] text-gray-200 rounded">
                        Privacy Policy
                      </button>
                    </Link>

                    <button
                      onClick={() => {
                        clerk.openUserProfile()
                        setOpenDropdown(null)
                      }}
                      className="flex items-center gap-3 w-full text-sm px-2 p-1 py-2.5 hover:bg-gray-50 rounded-sm text-gray-200 cursor-pointer"
                    >
                      Manage Account
                    </button>

                    <button
                      onClick={() => {
                        clerk.signOut()
                        setOpenDropdown(null)
                      }}
                      className="flex items-center gap-3 w-full text-sm px-2 py-2.5 p-1 text-gray-200 hover:bg-gray-50 rounded-sm cursor-pointer"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <button className="text-sm font-medium text-white hover:text-gray-300">
                  Sign In
                </button>
              </Link>
              <Link href="/sign-up">
                <button className="text-sm font-medium px-4 py-1.5 rounded bg-[#ff8c00c0] hover:bg-[#ff8c00e0] text-white">
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}