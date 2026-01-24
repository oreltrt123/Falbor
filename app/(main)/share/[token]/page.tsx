"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface ShareData {
  projectId: string
  projectTitle: string
  ownerName: string
  ownerImage: string
  isPublic: boolean
  redirectTo?: string
  message?: string
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareData, setShareData] = useState<ShareData | null>(null)

  // Fetch share info when user and token are ready
  useEffect(() => {
    if (isLoaded && token) fetchShareData()
  }, [isLoaded, token])

  const fetchShareData = async () => {
    try {
      const res = await fetch(`/api/share/${token}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setShareData(data)
    } catch {
      setError("Failed to load invitation")
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!shareData) return

    try {
      const res = await fetch(`/api/share/${token}/accept`, { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      router.push(data.redirectTo || `/projects/${shareData.projectId}`)
    } catch {
      setError("Failed to accept invitation")
    }
  }

  if (loading) return <p className="text-center mt-40">Loading...</p>

  if (!user) {
    return (
      <Card className="max-w-md mx-auto mt-40 p-6 text-center">
        <p>Please sign in to accept this invitation</p>
        <Button className="mt-4 w-full" onClick={() => router.push("/sign-in")}>
          Sign In
        </Button>
      </Card>
    )
  }

  if (error) {
    return <p className="text-center mt-40 text-red-500">{error}</p>
  }

  return (
    <Card className="max-w-md mx-auto mt-40 p-3 shadow-none">
      <div className="flex items-center">
        {shareData?.ownerImage && (
          <img
            src={shareData.ownerImage}
            alt={shareData.ownerName}
            className="w-8 h-8 rounded-full mr-3"
          />
        )}
        <div>
          <p className=""><span className="font-semibold">{shareData?.ownerName}</span> invited you to join their project</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold">{shareData?.projectTitle}</h2>

      {shareData?.message && (
        <p className="italic mb-4 border-l-4 pl-3 border-blue-400 text-gray-700">
          "{shareData.message}"
        </p>
      )}

      <Button onClick={handleAccept} className="w-full">
        Accept & Join
      </Button>
    </Card>
  )
}
