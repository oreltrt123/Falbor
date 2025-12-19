"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import MacOSDock from "./Button-dock"

// Dock apps → real site pages
const sampleApps = [
  {
    id: "pricing",
    name: "Pricing",
    icon: "/icons/pricing.png",
    href: "/pricing",
  },
  {
    id: "about",
    name: "About",
    icon: "/icons/about.png",
    href: "/about",
  },
  {
    id: "projects",
    name: "Projects",
    icon: "/icons/projects.png",
    href: "/projects",
  },
]

export default function DockDemo() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [openApps, setOpenApps] = useState<string[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const handleAppClick = (appId: string) => {
    const app = sampleApps.find((a) => a.id === appId)
    if (!app) return

    // Navigate to page
    if (app.href) {
      router.push(app.href)
    }

    // Toggle open-dot
    setOpenApps((prev) =>
      prev.includes(appId)
        ? prev.filter((id) => id !== appId)
        : [...prev, appId]
    )
  }

  return (
    <MacOSDock
      apps={sampleApps}
      onAppClick={handleAppClick}
      openApps={openApps}
    />
  )
}
