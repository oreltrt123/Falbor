// app/api/supabase/projects/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accessToken, orgId } = await request.json()

    if (!accessToken || typeof accessToken !== "string" || !accessToken.startsWith("sbp_")) {
      return NextResponse.json(
        { error: "Invalid or missing Supabase personal access token" },
        { status: 400 }
      )
    }

    if (!orgId) {
      return NextResponse.json({ error: "Missing organization ID" }, { status: 400 })
    }

    const response = await fetch("https://api.supabase.com/v1/projects", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[Supabase Projects Error]:", response.status, errorData)
      return NextResponse.json(
        { error: "Failed to fetch projects from Supabase" },
        { status: response.status }
      )
    }

    const projects = await response.json()
    const filteredProjects = projects.filter((p: any) => p.organization_id === orgId)

    return NextResponse.json(
      filteredProjects.map((p: any) => ({
        id: p.id,
        name: p.name,
        region: p.region_id,
      }))
    )
  } catch (error: any) {
    console.error("[Supabase Projects Route Error]:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}