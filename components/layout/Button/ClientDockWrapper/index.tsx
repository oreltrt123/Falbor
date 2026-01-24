"use client"

import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import DockDemo from "@/components/layout/Button"
import DefaultDemo from "../Navbar"

export default function ClientDockWrapper() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDeploySubdomain = useMemo(() => {
    if (!mounted) return false
    if (typeof window === "undefined") return false

    const hostname = window.location.hostname
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "falbor.xyz"

    // Examples:
    // www.falbor.xyz -> false
    // falbor.xyz -> false
    // 69ca20f5-....falbor.xyz -> true
    return (
      hostname.endsWith(`.${baseDomain}`) &&
      hostname !== baseDomain &&
      !hostname.startsWith("www.")
    )
  }, [mounted])

  const showDock =
    mounted &&
    !pathname?.startsWith("/chat/") &&
    !pathname?.startsWith("/deploy/") &&
    !isDeploySubdomain

  if (!showDock) return null

  return (
    <div>
      <DefaultDemo />
      {/* <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
        <DockDemo />
      </div> */}
    </div>
  )
}
