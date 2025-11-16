import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/config/db"
import { figmaTokens } from "@/config/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [tokenRow] = await db
      .select({ accessToken: figmaTokens.accessToken })
      .from(figmaTokens)
      .where(eq(figmaTokens.userId, userId))
      .limit(1)

    if (!tokenRow) {
      return NextResponse.json({ error: "Not connected to Figma" }, { status: 401 })
    }

    const res = await fetch("https://api.figma.com/v1/me/files", {
      headers: { Authorization: `Bearer ${tokenRow.accessToken}` },
    })

    if (!res.ok) {
      console.error("[Figma Files API] Fetch error:", res.statusText)
      return NextResponse.json({ error: "Failed to fetch files" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ files: data.files || [] })
  } catch (error) {
    console.error("[Figma Files API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 })
  }
}