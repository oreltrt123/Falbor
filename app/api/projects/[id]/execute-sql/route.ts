import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projectSupabase } from "@/config/schema"
import { eq } from "drizzle-orm"

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // ← params must be a Promise
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await context.params // ← await the params
    const { sql, accessToken } = await req.json()

    if (!sql || !accessToken) {
      return NextResponse.json(
        { error: "Missing sql or accessToken" },
        { status: 400 }
      )
    }

    // Get Supabase project for this projectId
    const [projSupa] = await db
      .select()
      .from(projectSupabase)
      .where(eq(projectSupabase.projectId, projectId))

    if (!projSupa) {
      return NextResponse.json(
        { error: "No Supabase connected" },
        { status: 404 }
      )
    }

    const ref = projSupa.supabaseProjectRef

    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    )

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: errData.message || "Failed to execute query" },
        { status: res.status }
      )
    }

    const result = await res.json()

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error: any) {
    console.error("Execute SQL error:", error)
    return NextResponse.json(
      { error: error.message || "Unexpected error occurred" },
      { status: 500 }
    )
  }
}
