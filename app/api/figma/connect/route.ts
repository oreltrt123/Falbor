import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/config/db"
import { figmaTokens } from "@/config/schema"
import { sql } from "drizzle-orm"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    console.error("[Figma Connect] No userId")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch (e) {
    console.error("[Figma Connect] JSON error:", e)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { token } = body
  if (!token || typeof token !== 'string' || token.length < 20) {
    return NextResponse.json({ error: "Invalid token format" }, { status: 400 })
  }

  try {
    // Insert/update explicitly (omit id)
    await db
      .insert(figmaTokens)
      //@ts-ignore
      .values({
        userId,
        accessToken: token,
      })
      .onConflictDoUpdate({
        target: figmaTokens.userId,
        set: {
          accessToken: sql`excluded.access_token`,
        },
      })

    console.log(`[Figma Connect] Saved for ${userId}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Figma Connect] Full error:", error)
    let msg = "Failed to save token"
    if (error.code === '23505') msg += " (duplicate user—try again)"
    else if (error.message?.includes('relation')) msg += " (table missing—migrate)"
    else if (error.message?.includes('column')) msg += " (schema mismatch—check migration)"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}