// app/api/supabase/api-keys/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accessToken, projectRef } = await request.json()

    if (!accessToken || typeof accessToken !== "string" || !accessToken.startsWith("sbp_")) {
      return NextResponse.json(
        { error: "Invalid or missing Supabase personal access token" },
        { status: 400 }
      )
    }

    if (!projectRef) {
      return NextResponse.json({ error: "Missing project reference" }, { status: 400 })
    }

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[Supabase API Keys Error]:", response.status, errorData)
      return NextResponse.json(
        { error: "Failed to fetch API keys from Supabase" },
        { status: response.status }
      )
    }

    const apiKeys = await response.json()
    const anonKey = apiKeys.find((key: any) => key.name === "anon")?.api_key

    if (!anonKey) {
      return NextResponse.json({ error: "Could not find anon key for project" }, { status: 400 })
    }

    const supabaseUrl = `https://${projectRef}.supabase.co`

    return NextResponse.json({
      supabaseUrl,
      anonKey,
    })
  } catch (error: any) {
    console.error("[Supabase API Keys Route Error]:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}