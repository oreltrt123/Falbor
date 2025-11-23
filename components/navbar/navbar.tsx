// Navbar.tsx
"use client"

import Link from "next/link"
import { useUser, useClerk } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"
import { Settings } from 'lucide-react'
import { israelTimeToUTC, utcToIsraelTime } from "@/lib/common/timezone/timezone-utils"
import { AutomationDialog } from "@/components/models/AutomationDialog" // Adjust path as needed
import { Badge } from "../ui/badge"

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
}

interface AutomationSettings {
  selectedModel: string
  dailyTime: string // "HH:MM:SS" UTC stored internally
  maxMessages: number
  isActive: boolean
  timezone: string
}

interface ModelOption {
  label: string
  icon: string
  color: string
  soon?: string
}

export type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss"

export function Navbar() {
  const { user, isLoaded } = useUser()
  const clerk = useClerk()
  const [open, setOpen] = useState(false)
  const [automationOpen, setAutomationOpen] = useState(false)
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch automation settings
  const fetchAutomation = async () => {
    if (!user?.id || !isLoaded) return
    try {
      const res = await fetch("/api/automation")
      if (res.ok) {
        const data = await res.json()
        setAutomationSettings(data)
      }
    } catch (err) {
      console.error("Failed to fetch automation:", err)
    }
  }

  useEffect(() => {
    fetchAutomation()
  }, [user?.id, isLoaded])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    } else {
      document.removeEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const fetchCredits = async () => {
    if (!user?.id || !isLoaded) return
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

  useEffect(() => {
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
  }, [user?.id, isLoaded])

  const refetchCredits = async () => {
    if (!user?.id) return
    await fetchCredits()
  }

  // Handle save automation
  const saveAutomation = async (settings: AutomationSettings) => {
    setLoading(true)
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setAutomationSettings(await res.json())
        alert("✅ Settings saved successfully!")
      } else {
        alert("❌ Failed to save settings.")
      }
    } catch (err) {
      console.error("Save failed:", err)
      alert("❌ Error saving settings.")
    } finally {
      setLoading(false)
      setAutomationOpen(false)
    }
  }

  // Test Now: Manual trigger for this user
  const testNow = async () => {
    if (!user?.id) return
    if (!automationSettings?.isActive) return alert("⚠️ Please activate automation first!")
    if (confirm("🧪 Simulate daily run now? This will deduct credits and create a new project.")) {
      try {
        const res = await fetch(`/api/cron/daily?test=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
        if (res.ok) {
          alert("✅ Test run triggered! Check your /projects page in 10 seconds for the new creation.")
          refetchCredits()
        } else {
          const err = await res.text()
          alert(`❌ Test failed: ${err || "Unknown error—check server logs."}`)
        }
      } catch (err) {
        alert("❌ Error: " + (err as Error).message)
      }
    }
  }

  const modelOptions: Record<ModelType, ModelOption> = {
    gemini: { label: "Gemini 2.0", icon: "/icons/gemini.png", color: "text-blue-400" },
    claude: { label: "Claude Sonnet 4.5", icon: "/icons/claude.png", color: "text-purple-400" },
    gpt: { label: "GPT-5", icon: "/icons/openai.png", color: "text-green-400" },
    deepseek: { label: "Deepseek R3", icon: "/icons/deepseek.png", color: "text-teal-400" },
    gptoss: { label: "GPT-OSS 20B", icon: "/icons/openai.png", color: "text-green-400" },
  }

  const parseTime = (utcTime24: string) => {
    if (!utcTime24) {
      const default_israel = utcToIsraelTime("11", "00", "00")
      return { ...default_israel, hour: default_israel.hour || 14 }
    }

    const parts = utcTime24.split(":")
    const israelTime = utcToIsraelTime(parts[0] || "11", parts[1] || "00", parts[2] || "00")
    return israelTime
  }

  const currentParsed = automationSettings ? parseTime(automationSettings.dailyTime) : { hour: 14, minute: 0, second: 0, timezone: "UTC+2 (IST)" }

  const updateTime = (key: "hour" | "minute" | "second" | "ampm", val: number | string) => {
    if (!automationSettings) return
    let newSettings = { ...automationSettings }

    // For now, we assume all input is in 24-hour Israel time
    // Convert to UTC internally
    const newUtcTime = israelTimeToUTC(
      key === "hour" ? Number(val) : currentParsed.hour,
      key === "minute" ? Number(val) : currentParsed.minute,
      key === "second" ? Number(val) : currentParsed.second,
    )

    newSettings.dailyTime = newUtcTime
    setAutomationSettings(newSettings)
  }

  const handleSave = () => {
    if (automationSettings) saveAutomation(automationSettings)
  }

  const handleUpdateSettings = (updater: (prev: AutomationSettings) => AutomationSettings) => {
    setAutomationSettings((prev) => {
      if (!prev) return prev
      return updater(prev)
    })
  }

  return (
    <>
      <nav className="z-50 fixed w-full">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-sans font-light text-white">
            <img width={140} className="relative top-[-1px]" src="/logo.png" alt="" />
          </Link>
          <div className="flex flex-1 ml-10">
            {user && (
              <Link href={"/projects"} className="text-white hover:text-[#f0f0f0]">
                Projects
              </Link>
            )}
              <Link href={"/about"} className="text-white hover:text-[#f0f0f0] ml-6">
                About
              </Link>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative top-1">
                {creditsData && (
                  <button className="text-black/90 text-[12px] mb-1 p-1 px-2.5 top-[-6px] relative">
                    <span className="flex items-center gap-2 bg-white rounded-md px-2 py-1">
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
                )}

                <button
                  onClick={() => setOpen(!open)}
                  className="w-8 h-8 rounded-full mt-1 overflow-hidden focus:outline-none cursor-pointer"
                >
                  <img
                    src={user.imageUrl || "/placeholder.svg"}
                    alt={user.firstName || "User"}
                    className="w-full h-full object-cover"
                  />
                </button>

                <div
                  ref={dropdownRef}
                  className={`absolute mt-[-20px] right-0 mt-2 w-56 bg-[#141414] border border-[#3b3b3f2f] rounded-lg shadow-lg z-50 ${
                    open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
                  }`}
                >
                  <div className="flex flex-col p-1">
                    {creditsData && (
                      <Link href={"/"} className="text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default">
                        <button
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-[2px] w-full text-[13px]"
                        >
                          <img src="/icons/CreditsIcon.png" className="mr-2 opacity-80" width={20} alt="" />
                          <span className="mt-[2px]">Next credits in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
                        </button>
                      </Link>
                    )}
                    <Link href={"/projects"} className="text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default">
                      <button
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-[2px] w-full text-[13px]"
                      >
                        <img src="/icons/project.png" className="mr-2 opacity-80" width={20} alt="" />
                        <span>Projects</span>
                      </button>
                    </Link>
                    <Link href={"/legal/privacy"} className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default">
                      <button
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-[2px] w-full text-[13px]"
                      >
                        <img src="/icons/privacy-policy.png" className="mr-2 opacity-80" width={20} alt="" />
                        <span>Privacy Policy</span>
                      </button>
                    </Link>
                    <button
                      onClick={() => {
                        setOpen(false)
                        setAutomationOpen(true)
                      }}
                      className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default text-[13px]"
                    >
                      <Settings className="mr-2 h-4 w-4 opacity-80" />
                      <span>Manage AI <Badge className="ml-1 bg-[#2e2e2e5d] text-white">Beta</Badge></span>
                    </button>
                    <button
                      onClick={() => {
                        clerk.openUserProfile()
                        setOpen(false)
                      }}
                      className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default text-[13px]"
                    >
                      <img src="/icons/user.png" className="mr-2 opacity-80" width={20} alt="" />
                      <span>Manage Account</span>
                    </button>
                    <button
                      onClick={() => {
                        clerk.signOut()
                        setOpen(false)
                      }}
                      className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default text-[13px]"
                    >
                      <img src="/icons/logout.png" className="mr-2 opacity-80" width={20} alt="" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Link href={"/sign-in"}>
                  <button className="text-sm font-medium cursor-pointer text-white">Sign In</button>
                </Link>
                <Link href={"/sign-up"}>
                  <button className="text-sm font-medium cursor-pointer w-[70px] bg-[#ff8c00c0] p-1 rounded-md text-[#e9e9e9]">
                    Sign Up
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <AutomationDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        automationSettings={automationSettings}
        onUpdateSettings={handleUpdateSettings}
        onSave={handleSave}
        onTestNow={testNow}
        loading={loading}
        modelOptions={modelOptions}
        currentParsed={currentParsed}
        onUpdateTime={updateTime}
      />
    </>
  )
}