import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projectSupabase, projects } from "@/config/schema"
import { eq, and } from "drizzle-orm"

type RouteContext = {
  params: Promise<{ id: string }>
}

/* ----------------------------------------
   GET: Fetch Supabase credentials
---------------------------------------- */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Fetch Supabase credentials
    const credentials = await db
      .select({
        supabaseUrl: projectSupabase.supabaseUrl,
        anonKey: projectSupabase.anonKey,
      })
      .from(projectSupabase)
      .where(eq(projectSupabase.projectId, projectId))
      .limit(1)

    if (credentials.length === 0) {
      return NextResponse.json({ supabaseUrl: null, anonKey: null })
    }

    return NextResponse.json(credentials[0])
  } catch (error) {
    console.error("[Supabase GET Error]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ----------------------------------------
   POST: Save Supabase credentials
---------------------------------------- */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const { supabaseUrl, anonKey } = await request.json()

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Missing supabaseUrl or anonKey" },
        { status: 400 }
      )
    }

    // Verify ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const existing = await db
      .select()
      .from(projectSupabase)
      .where(eq(projectSupabase.projectId, projectId))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(projectSupabase)
        .set({
          supabaseUrl,
          anonKey,
          updatedAt: new Date(),
        })
        .where(eq(projectSupabase.projectId, projectId))
    } else {
      await db.insert(projectSupabase).values({
        projectId,
        supabaseProjectRef:
          supabaseUrl.split("//")[1]?.split(".")[0] || "unknown",
        supabaseUrl,
        anonKey,
        serviceRoleKey: "",
        dbPassword: "",
        region: "unknown",
        isActive: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Supabase POST Error]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
