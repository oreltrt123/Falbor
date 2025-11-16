// New file: app/api/auth/figma/callback/route.ts
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/config/db"
import { figmaTokens } from "@/config/schema"
import { eq } from "drizzle-orm"
import { sql } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=invalid_auth", req.url))
  }

  const { userId } = await auth()
  if (!userId || state !== userId) {
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url))
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const clientId = process.env.FIGMA_CLIENT_ID
    const clientSecret = process.env.FIGMA_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error("Figma credentials not configured")
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/api/auth/figma/callback`,
    })

    const tokenRes = await fetch("https://www.figma.com/api/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: body.toString(),
    })

    if (!tokenRes.ok) {
      console.error("[Figma Callback] Token error:", tokenRes.statusText)
      return NextResponse.redirect(new URL("/?error=token_failed", req.url))
    }

    const data = await tokenRes.json()
    if (!data.access_token) {
      throw new Error("No access token received")
    }

    // Insert or update token (assumes unique constraint on userId)
    await db
      .insert(figmaTokens)
      .values({
        userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      })
      .onConflictDoUpdate({
        target: figmaTokens.userId,
        set: {
          accessToken: sql`excluded.access_token`,
          refreshToken: sql`excluded.refresh_token`,
          expiresAt: sql`excluded.expires_at`,
        },
      })

    return NextResponse.redirect(new URL("/?success=figma_connected", req.url))
  } catch (error) {
    console.error("[Figma Callback] Error:", error)
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url))
  }
}