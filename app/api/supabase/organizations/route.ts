// app/api/supabase/organizations/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accessToken } = await request.json()

    if (!accessToken || typeof accessToken !== "string" || !accessToken.startsWith("sbp_")) {
      return NextResponse.json(
        { error: "Invalid or missing Supabase personal access token" },
        { status: 400 }
      )
    }

    const response = await fetch("https://api.supabase.com/v1/organizations", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[Supabase Organizations Error]:", response.status, errorData)
      return NextResponse.json(
        { error: "Failed to fetch organizations from Supabase" },
        { status: response.status }
      )
    }

    const orgs = await response.json()
    return NextResponse.json(
      orgs.map((org: any) => ({
        id: org.id,
        name: org.name,
      }))
    )
  } catch (error: any) {
    console.error("[Supabase Organizations Route Error]:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}