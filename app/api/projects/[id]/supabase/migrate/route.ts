import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, projectSupabase, projectLogs } from "@/config/schema"
import { eq } from "drizzle-orm"
import { runMigration } from "@/lib/supabase/management-api"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }   // ← changed here
) {
  const params = await context.params               // ← await it
  const projectId = params.id                       // ← now safe

  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { sql } = body

    if (!sql) {
      return new Response(JSON.stringify({ error: "SQL is required" }), { status: 400 })
    }

    // Get project and Supabase credentials
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project || project.userId !== userId) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
    }

    const [supabaseConfig] = await db
      .select()
      .from(projectSupabase)
      .where(eq(projectSupabase.projectId, projectId))

    if (!supabaseConfig) {
      return new Response(
        JSON.stringify({
          error: "Supabase not provisioned for this project",
        }),
        { status: 400 },
      )
    }

    // Run the migration
    const result = await runMigration(supabaseConfig.supabaseProjectRef, sql)

    if (!result.success) {
      await db.insert(projectLogs).values({
        projectId,
        level: "error",
        message: "Migration failed",
        details: { error: result.error, sql: sql.substring(0, 200) },
      })

      return new Response(
        JSON.stringify({
          error: result.error,
        }),
        { status: 400 },
      )
    }

    await db.insert(projectLogs).values({
      projectId,
      level: "success",
      message: "Migration executed successfully",
      details: { sql: sql.substring(0, 200) },
    })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("[Supabase Migration] Error:", error)
    return new Response(
      JSON.stringify({
        error: String(error),
      }),
      { status: 500 },
    )
  }
}