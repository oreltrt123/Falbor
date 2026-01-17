// app/api/supabase/execute-sql/route.ts
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { userSupabaseConnections } from "@/config/schema"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  context: { params?: {} } // ← Next.js expects context with optional params here
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sql, projectId } = await request.json()

    if (!sql) {
      return NextResponse.json({ error: "SQL content is required" }, { status: 400 })
    }

    // Get the stored Supabase connection from DB
    const [connection] = await db
      .select()
      .from(userSupabaseConnections)
      .where(eq(userSupabaseConnections.userId, userId))
      .limit(1)

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "No active Supabase connection found. Please connect your Supabase account first." },
        { status: 401 },
      )
    }

    const { accessToken, selectedProjectRef } = connection

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token found. Please reconnect your Supabase account." },
        { status: 401 },
      )
    }

    // Use the project from connection or the provided projectId
    const targetProjectRef = projectId || selectedProjectRef

    if (!targetProjectRef) {
      return NextResponse.json(
        { error: "No project selected. Please select a Supabase project first." },
        { status: 400 },
      )
    }

    // Execute SQL using Supabase Management API
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${targetProjectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Supabase API error:", errorData)
      return NextResponse.json(
        { error: errorData.message || errorData.error || "Failed to execute SQL on Supabase" },
        { status: response.status },
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: "SQL executed successfully",
      result,
    })
  } catch (error: any) {
    console.error("Execute SQL error:", error)
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
