import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
    }

    const clientId = process.env.NEXT_PUBLIC_SUPABASE_CLIENT_ID
    const clientSecret = process.env.SUPABASE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Supabase OAuth credentials not configured" }, { status: 500 })
    }

    const redirectUri = `${request.nextUrl.origin}/api/supabase/callback`

    // Exchange the authorization code for an access token
    const tokenResponse = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error("Token exchange failed:", errorData)
      return NextResponse.json({ error: "Failed to exchange authorization code" }, { status: 400 })
    }

    const tokenData = await tokenResponse.json()

    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
    })
  } catch (error) {
    console.error("Token exchange error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
