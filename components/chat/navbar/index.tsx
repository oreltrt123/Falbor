"use client" // <- Important! Must be at the top of the file

import Link from "next/link"
import { SignInButton, SignUpButton, useUser, useClerk } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"

export function Navbar() {
  const { user } = useUser()
  const clerk = useClerk()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  return (
    <nav className="border-[#4444442d] bg-[#1b1b1b] border-b z-50 fixed w-full">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link href="/" className="text-xl font-sans font-light text-white absolute left-3">
          <img width={140} className="relative top-[-1px]" src="/logo.png" alt="" />
        </Link>
        <div className="flex flex-1 ml-10">
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="absolute right-8">
              {/* Profile button */}
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
              <div
                ref={dropdownRef}
                className={`absolute mt-[-20px] right-0 mt-2 w-56 bg-[#1b1b1b] border border-[#3b3b3f2f] rounded-lg shadow-lg z-50 transition-all duration-200 ease-in-out transform ${
                  open ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                }`}
              >
                {/* <div className="p-3 border-b border-[#3b3b3f2f]">
                  <p className="text-white/90 font-medium truncate">{user.fullName}</p>
                  <p className="text-white/80 text-sm truncate">{user.emailAddresses[0]?.emailAddress}</p>
                </div> */}

                <div className="flex flex-col p-2">
                  <Link href={'/projects'} className="text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm cursor-pointer rounded-md">
                    <button
                      onClick={() => {
                      clerk.openUserProfile()
                       setOpen(false)
                      }}
                      className="flex items-center gap-[2px]"
                  >
                    <img src="/icons/project.png" className="mr-2 opacity-30 hover:opacity-25" width={20} alt="" />
                    <span>Projects</span>
                  </button>
                  </Link>
                  <Link href={'/legal/privacy'} className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm cursor-pointer rounded-md">
                    <button
                      onClick={() => {
                      clerk.openUserProfile()
                       setOpen(false)
                      }}
                      className="flex items-center gap-[2px] w-full"
                  >
                    <img src="/icons/privacy-policy.png" className="mr-2 opacity-30 hover:opacity-25" width={20} alt="" />
                    <span>Privacy Policy</span>
                  </button>
                  </Link>
                  <button
                    onClick={() => {
                      clerk.openUserProfile()
                      setOpen(false)
                    }}
                    className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm cursor-pointer rounded-md"
                  >
                    <img src="/icons/user.png" className="mr-2 opacity-30 hover:opacity-25" width={20} alt="" />
                    <span>Manage Account</span>
                  </button>
                  <button
                    onClick={() => {
                      clerk.signOut()
                      setOpen(false)
                    }}
                    className="flex items-center gap-[2px] text-left px-4 py-2 hover:bg-[#2e2e2e5d] text-white text-sm cursor-pointer rounded-md"
                  >
                    <img src="/icons/logout.png" className="mr-2 opacity-30 hover:opacity-25" width={20} alt="" />
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