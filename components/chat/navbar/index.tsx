"use client"

import Link from "next/link"
import { useUser, useClerk, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"
import {
  Copy,
  ExternalLink,
  Check,
  Share2,
  Globe,
  Pencil,
  List,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDistanceToNow } from "date-fns"
import { ShareDialog } from "@/components/chat/share-dialog"
import { motion, AnimatePresence } from "framer-motion"

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
}

interface DeploymentData {
  deploymentUrl: string
  updatedAt: string
  subdomain: string
}

interface NavbarProps {
  projectId: string
  handleDownload: () => void
}

export function Navbar({ projectId, handleDownload }: NavbarProps) {
  const { user, isLoaded } = useUser()
  const clerk = useClerk()
  const { getToken } = useAuth()

  // Dropdown state
  type OpenDropdown = "profile" | "publish" | "share" | null
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const publishDropdownRef = useRef<HTMLDivElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [isPublishing, setIsPublishing] = useState(false)
  const [deployment, setDeployment] = useState<DeploymentData | null>(null)
  const [copied, setCopied] = useState(false)

  // Publish dialog internal state
  const [publishView, setPublishView] = useState<"main" | "edit-domain">("main")
  const [newSubdomain, setNewSubdomain] = useState("")
  const [republishAfterUpdate, setRepublishAfterUpdate] = useState(true)
  const [isSavingDomain, setIsSavingDomain] = useState(false)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !dropdownRef.current?.contains(event.target as Node) &&
        !publishDropdownRef.current?.contains(event.target as Node) &&
        !shareRef.current?.contains(event.target as Node)
      ) {
        setOpenDropdown(null)
        setPublishView("main") // reset view when closing
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch credits + timer (unchanged)
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

  // Fetch deployment when publish dialog opens
  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        const token = await getToken()
        const res = await fetch(`/api/projects/${projectId}/deployment`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.deployment?.deploymentUrl && data.deployment?.updatedAt && data.deployment?.subdomain) {
            setDeployment({
              deploymentUrl: data.deployment.deploymentUrl,
              updatedAt: data.deployment.updatedAt,
              subdomain: data.deployment.subdomain,
            })
            setNewSubdomain(data.deployment.subdomain)
          }
        }
      } catch (err) {
        console.error("Failed to fetch deployment:", err)
      }
    }

    if (openDropdown === "publish") {
      fetchDeployment()
    }
  }, [openDropdown, projectId, getToken])

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error("Deployment failed")

      const data = await res.json()
      setDeployment({
        deploymentUrl: data.deploymentUrl,
        updatedAt: new Date().toISOString(),
        subdomain: data.subdomain || projectId.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      })
      window.open(data.deploymentUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      alert(`Failed to deploy: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsPublishing(false)
    }
  }

  const handleUpdateDomain = async () => {
    if (!deployment || !newSubdomain.trim() || newSubdomain === deployment.subdomain) {
      setPublishView("main")
      return
    }

    setIsSavingDomain(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subdomain: newSubdomain.trim(),
          republish: republishAfterUpdate,
        }),
      })

      if (!res.ok) throw new Error("Domain update failed")

      const data = await res.json()
      setDeployment({
        deploymentUrl: data.deploymentUrl,
        updatedAt: new Date().toISOString(),
        subdomain: data.subdomain,
      })
      setPublishView("main")
    } catch (err) {
      alert("Failed to update domain")
      console.error(err)
    } finally {
      setIsSavingDomain(false)
    }
  }

  const handleCopyDeploymentUrl = async () => {
    if (deployment?.deploymentUrl) {
      await navigator.clipboard.writeText(deployment.deploymentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
                  "text-black hover:text-black/80 BackgroundStyle"
                )}
                style={{
                  border: "1px solid #d6d4ce",
                }}
                title="Download project as ZIP"
              >
                Download
              </button>

              {/* Share */}
              <div className="relative" ref={shareRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "share" ? null : "share")}
                  className={cn(
                    "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer",
                    "BackgroundStyleButton text-black/80"
                  )}
                >
                  <Share2 size={16} />
                  Share
                </button>

                <ShareDialog
                  projectId={projectId}
                  isOpen={openDropdown === "share"}
                  onClose={() => setOpenDropdown(null)}
                />
              </div>

              {/* Publish Button + Dialog */}
              <div className="relative" ref={publishDropdownRef}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "publish" ? null : "publish")}
                  className={cn(
                    "flex items-center gap-1 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer",
                    isPublishing
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "BackgroundStyleButton text-black/80"
                  )}
                  disabled={isPublishing}
                >
                  {isPublishing ? "Publishing..." : "Publish"}
                </button>

                {openDropdown === "publish" && (
                  <div className="absolute top-full right-0 mt-[-10px] w-96 bg-white border rounded-lg z-50">
                    {/* Header - same style as ShareDialog */}
                    <div className="flex items-center justify-between p-4 border-b">
                      {publishView !== "main" && (
                        <button
                          onClick={() => setPublishView("main")}
                          className="p-1 BackgroundStyle rounded mr-2"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      )}
                      <h3 className="font-semibold text-base flex-1">
                        {publishView === "main" ? "Publish Your Site" : "Edit Domain"}
                      </h3>
                    </div>

                    <AnimatePresence mode="wait">
                      {publishView === "main" && (
                        <motion.div
                          key="main"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className="p-4 space-y-4"
                        >
                          {deployment?.deploymentUrl ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-1 rounded-sm">
                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Globe className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <p className="text-sm font-medium truncate min-w-0">
                                      {deployment.deploymentUrl}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 min-w-0">
                                    <List className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <p className="text-xs text-gray-500 truncate min-w-0">
                                      Updated {formatDistanceToNow(new Date(deployment.updatedAt), { addSuffix: true })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={handleCopyDeploymentUrl}
                                    className="p-1.5 BackgroundStyle rounded cursor-pointer"
                                    title="Copy link"
                                  >
                                    {copied ? (
                                      <Check className="w-4 h-4 text-black" />
                                    ) : (
                                      <Copy className="w-4 h-4 text-black" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setPublishView("edit-domain")}
                                    className="p-1.5 BackgroundStyle rounded cursor-pointer"
                                    title="Edit domain"
                                  >
                                    <Pencil className="w-4 h-4 text-black" />
                                  </button>
                                  <a
                                    href={deployment.deploymentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 BackgroundStyle rounded cursor-pointer"
                                    title="Open in new tab"
                                  >
                                    <ExternalLink className="w-4 h-4 text-black" />
                                  </a>
                                </div>
                              </div>

                              <Button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="w-full"
                              >
                                {isPublishing ? "Publishing..." : "Update Deployment"}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-6 text-center text-sm text-gray-500 border rounded-sm">
                                Your site is not published yet
                              </div>
                              <Button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="w-full"
                              >
                                {isPublishing ? "Publishing..." : "Publish Now"}
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {publishView === "edit-domain" && deployment && (
                        <motion.div
                          key="edit-domain"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className="p-4 space-y-4"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Current</p>
                            <p className="text-sm text-gray-600 break-all">{deployment.deploymentUrl}</p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">New subdomain</label>
                            <Input
                              value={newSubdomain}
                              onChange={(e) =>
                                setNewSubdomain(
                                  e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9-]/g, "")
                                )
                              }
                              placeholder="your-site-name"
                            />
                            <p className="text-xs text-gray-500">
                              Will be available at https://{newSubdomain || "your-site-name"}.falbor.xyz
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="republish"
                              checked={republishAfterUpdate}
                              onChange={(e) => setRepublishAfterUpdate(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <label htmlFor="republish" className="text-sm text-gray-700">
                              Republish site after updating
                            </label>
                          </div>

                          <Button
                            onClick={handleUpdateDomain}
                            disabled={isSavingDomain || !newSubdomain.trim() || newSubdomain === deployment.subdomain}
                            className="w-full"
                          >
                            {isSavingDomain ? "Saving..." : "Save & Update"}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Profile */}
              <button
                onClick={() => setOpenDropdown(openDropdown === "profile" ? null : "profile")}
                className="w-8 h-8 rounded-full overflow-hidden focus:outline-none cursor-pointer"
              >
                <img
                  src={user.imageUrl || "/placeholder.svg"}
                  alt={user.firstName || "User"}
                  className="w-full h-full object-cover"
                />
              </button>

              {/* Profile Dropdown - unchanged */}
              {openDropdown === "profile" && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full right-0 mt-[-10px] w-60 BackgroundStyleButton rounded-md z-50 transition-all duration-200"
                >
                  <div className="flex flex-col p-1">
                    {creditsData && (
                      <div className="hover:bg-gray-50 rounded-sm p-1 flex items-center gap-3 w-full text-sm px-2 py-1.5 text-black/80">
                        Next credits in{" "}
                        <span className="font-mono">
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    )}

                    <Link href="/projects" className="hover:bg-gray-50 rounded-sm p-1 cursor-pointer">
                      <button className="flex items-center gap-3 cursor-pointer w-full text-sm px-2 py-0.5 text-black/80 rounded">
                        Projects
                      </button>
                    </Link>

                    <Link href="/legal/privacy" className="hover:bg-gray-50 rounded-sm p-1 cursor-pointer">
                      <button className="flex items-center gap-3 cursor-pointer w-full text-sm px-2 py-0.5 text-black/80 rounded">
                        Privacy Policy
                      </button>
                    </Link>

                    <button
                      onClick={() => {
                        clerk.openUserProfile()
                        setOpenDropdown(null)
                      }}
                      className="flex items-center gap-3 w-full text-sm px-2 p-1 py-1.5 hover:bg-gray-50 rounded-sm text-black/80 cursor-pointer"
                    >
                      Manage Account
                    </button>

                    <button
                      onClick={() => {
                        clerk.signOut()
                        setOpenDropdown(null)
                      }}
                      className="flex items-center gap-3 w-full text-sm px-2 py-1.5 p-1 text-black/80 hover:bg-gray-50 rounded-sm cursor-pointer"
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