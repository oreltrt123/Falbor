"use client" // <- Important! Must be at the top of the file

import Link from "next/link"
import { useUser, useClerk, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"
import { Globe, Code2, Download, Settings, Database } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
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
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null)

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Fetch credits and start timer
  useEffect(() => {
    if (!isLoaded || !user?.id) return

    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/user/credits")
        if (res.ok) {
          const data: CreditsData = await res.json()
          setCreditsData(data)
          setTimeLeft(data.secondsUntilNextRegen)
        } else {
          console.error(`Failed to fetch credits: ${res.status} ${res.statusText}`)
        }
      } catch (err) {
        console.error("Failed to fetch credits:", err)
      }
    }

    fetchCredits()

    if (timerRef.current) clearInterval(timerRef.current)
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
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          return // No deployment yet, or error - just keep null
        }

        const data = await response.json()
        setDeployedUrl(data.deploymentUrl || null)
      } catch (error) {
        console.error("[v0] Error fetching deployment:", error)
      }
    }

    fetchDeployment()
  }, [projectId, getToken])

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

      console.log("[v0] Deployment successful:", data.deploymentUrl)
      window.open(data.deploymentUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      console.error("[v0] Deployment error:", error)
      alert(`Failed to deploy: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <nav className="z-50 fixed w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-sans font-light text-white absolute left-8">
          <img width={140} className="relative top-[-1px]" src="/logo_light.png" alt="Logo" />
        </Link>

        <div className="flex items-center gap-2 absolute right-3 mb-2">
          {user ? (
            <>
              <button
                id="download-button"
                onClick={handleDownload}
                className={cn(
                  "flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors cursor-pointer bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black"
                )}
                title="Download project as ZIP"
              >
                Download
              </button>
              <button
                onClick={handleDeploy}
                disabled={isDeploying}
                className={cn(
                  "flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors cursor-pointer",
                  isDeploying ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-[#2b2525] hover:bg-[#2b2525ce] text-white",
                )}
                title="Deploy to production"
              >
                {isDeploying ? "Publishing your site..." : "Publish"}
              </button>

              {/* {deployedUrl && (
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline px-2 py-1"
                  title="Open deployed site"
                >
                  {deployedUrl}
                </a>
              )}
               */}

              {/* Credits display */}
              {/* {creditsData && (
                <button className="text-black/90 text-[12px] p-1 px-2.5">
                  <span className="flex items-center gap-2 bg-[#e4e4e4] rounded-md px-2 py-1">
                    <img
                      src="/icons/credit-card.png"
                      alt="Credits icon"
                      width={16}
                      height={16}
                      className="opacity-80"
                    />
                    <span>{creditsData.credits} credits remaining</span>
                  </span>
                </button>
              )} */}
              {/* Profile button */}
              <button
                onClick={() => setOpen(!open)}
                className="w-8 h-8 rounded-full overflow-hidden focus:outline-none cursor-pointer"
              >
                <img
                  src={user.imageUrl}
                  alt={user.firstName || "User"}
                  className="w-full h-full object-cover"
                />
              </button>

              {/* Dropdown */}
              <div
                ref={dropdownRef}
                className={`absolute mt-56 right-0 w-56 bg-[#141414] border border-[#3b3b3f2f] rounded-lg shadow-lg z-50 transition-all duration-200 ease-in-out transform ${
                  open ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                }`}
              >
                <div className="flex flex-col p-1">
                  {/* Next credits */}
                  {creditsData && (
                    <button
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 w-full text-[13px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white rounded-md cursor-default"
                    >
                      <img src="/icons/CreditsIcon.png" className="mr-2 opacity-80" width={20} alt=""/>
                      <span>
                        Next credits in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                      </span>
                    </button>
                  )}

                  {/* Projects */}
                  <Link href="/projects">
                    <button
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 w-full text-[13px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white rounded-md cursor-default"
                    >
                      <img src="/icons/project.png" className="mr-2 opacity-80" width={20} alt="" />
                      <span>Projects</span>
                    </button>
                  </Link>

                  {/* Privacy Policy */}
                  <Link href="/legal/privacy">
                    <button
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 w-full text-[13px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white rounded-md cursor-default"
                    >
                      <img src="/icons/privacy-policy.png" className="mr-2 opacity-80" width={20} alt="" />
                      <span>Privacy Policy</span>
                    </button>
                  </Link>

                  {/* Manage Account */}
                  <button
                    onClick={() => {
                      clerk.openUserProfile()
                      setOpen(false)
                    }}
                    className="flex items-center gap-2 w-full text-[13px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white rounded-md cursor-default"
                  >
                    <img src="/icons/user.png" className="mr-2 opacity-80" width={20} alt="" />
                    <span>Manage Account</span>
                  </button>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      clerk.signOut()
                      setOpen(false)
                    }}
                    className="flex items-center gap-2 w-full text-[13px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white rounded-md cursor-default"
                  >
                    <img src="/icons/logout.png" className="mr-2 opacity-80" width={20} alt="" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <button className="text-sm font-medium cursor-pointer text-white">Sign In</button>
              </Link>
              <Link href="/sign-up">
                <button className="text-sm font-medium cursor-pointer w-[70px] bg-[#ff8c00c0] p-1 rounded-md text-[#e9e9e9]">
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