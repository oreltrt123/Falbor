import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: sandboxId } = await params

    // Get sandbox status
    const response = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_E2B_API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to get sandbox status")
    }

    const sandbox = await response.json()
    const previewUrl = `https://${sandboxId}.e2b.dev`

    return NextResponse.json({
      sandboxId,
      previewUrl,
      status: sandbox.status,
    })
  } catch (error) {
    console.error("Sandbox status error:", error)
    return NextResponse.json({ error: "Failed to get sandbox status" }, { status: 500 })
  }
}
