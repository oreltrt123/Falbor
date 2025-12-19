"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import DockDemo from "@/components/layout/Button"
import DefaultDemo from "../Navbar"

export default function ClientDockWrapper() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const showDock = mounted && !pathname?.startsWith("/chat/")

  if (!showDock) return null

  return (
    <div>
      <DefaultDemo />
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
        <DockDemo />
      </div>
    </div>
  )
}
