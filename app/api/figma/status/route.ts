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
      .select()
      .from(figmaTokens)
      .where(eq(figmaTokens.userId, userId))
      .limit(1)
    const connected = tokenRow !== undefined
    return NextResponse.json({ connected })
  } catch (error) {
    console.error("[Figma Status API] Error:", error)
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}