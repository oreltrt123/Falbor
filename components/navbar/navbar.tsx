"use client" // <- Important! Must be at the top of the file

import Link from "next/link"
import { SignInButton, SignUpButton, useUser, useClerk } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
}


export function Navbar() {
  const { user, isLoaded } = useUser()
  const clerk = useClerk()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

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

  return (
    <nav className="border-[#1b1b1b79] bg-[#1b1b1b79] border-b z-50 fixed w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-sans font-light text-white">
          <img width={140} className="relative top-[-1px]" src="/logo.png" alt="" />
        </Link>
        <div className="flex flex-1 ml-10">
        {user && (
          <Link href={'/projects'} className="text-white hover:text-[#f0f0f0]">
            Projects
          </Link>
        )}
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="relative top-1">
              {/* Profile button */}
              {creditsData && (
                <button className="text-white/90 text-[12px] mb-1 p-1 px-2.5 top-[-6px] relative">
                  <span className="flex items-center gap-2 border border-[#272727] rounded-md px-2 py-1">
                    <img
                    src="/icons/coin.png"
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
                className="w-8 h-8 rounded-full mt-1 overflow-hidden  focus:outline-none cursor-pointer"
              >
                <img
                  src={user.imageUrl}
                  alt={user.firstName || "User"}
                  className="w-full h-full object-cover"
                />
              </button>
            
              {/* Dropdown */}
              {/* transition-all duration-200 ease-in-out transform */}
              <div
                ref={dropdownRef}
                className={`absolute mt-[-20px] right-0 mt-2 w-56 bg-[#141414] border border-[#3b3b3f2f] rounded-lg shadow-lg z-50 ${  
                  open ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                }`}
              >
                <div className="">
                  {/* <p className="text-white/90 font-medium truncate">{user.fullName}</p> */}
                  {/* <p className="text-white/80 text-sm truncate">{user.emailAddresses[0]?.emailAddress}</p> */}
                </div>

                <div className="flex flex-col p-1">
                  {creditsData && (
                  <Link href={'/'} className="text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default">
                    <button
                      onClick={() => {
                      setOpen(false)
                      }}
                      className="flex items-center gap-[2px] w-full text-[13px]"
                  >
                    <img src="/icons/CreditsIcon.png" className="mr-2 opacity-80" width={20} alt="" />
                    <span className="mt-[2px]">Next credits in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
                  </button>
                  </Link>
                  )}
                  <Link href={'/projects'} className="text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default">
                    <button
                      onClick={() => {
                      setOpen(false)
                      }}
                      className="flex items-center gap-[2px] w-full text-[13px]"
                  >
                    <img src="/icons/project.png" className="mr-2 opacity-80" width={20} alt="" />
                    <span>Projects</span>
                  </button>
                  </Link>
                  <Link href={'/legal/privacy'} className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm rounded-md cursor-default">
                    <button
                      onClick={() => {
                      setOpen(false)
                      }}
                      className="flex items-center gap-[2px] w-full text-[13px]"
                  >
                    <img src="/icons/privacy-policy.png" className="mr-2 opacity-80" width={20} alt="" />
                    <span>Privacy Policy</span>
                  </button>
                  </Link>
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
              <Link href={'/sign-in'}>
                <button className="text-sm font-medium cursor-pointer text-white">Sign In</button>
              </Link>
              <Link href={'/sign-up'}>
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