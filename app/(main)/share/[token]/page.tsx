"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareData, setShareData] = useState<any>(null)

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
      setError("Failed to load link")
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    const res = await fetch(`/api/share/${token}/accept`, { method: "POST" })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      return
    }

    router.push(data.redirectTo) // ✅ uses API redirect
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
    <Card className="max-w-md mx-auto mt-40 p-6">
      <h2 className="text-xl font-semibold mb-4">Project Invitation</h2>
      <p className="mb-4">{shareData.projectTitle}</p>
      <Button onClick={handleAccept} className="w-full">
        Accept & Join
      </Button>
    </Card>
  )
}
