// Logs management
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projectLogs } from "@/config/schema"
import { eq, desc } from "drizzle-orm"

// GET - List logs
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params
  const { searchParams } = new URL(request.url)
  const limit = Number.parseInt(searchParams.get("limit") || "100")

  try {
    const logs = await db
      .select({
        id: projectLogs.id,
        level: projectLogs.level,
        message: projectLogs.message,
        details: projectLogs.details,
        created_at: projectLogs.createdAt,
      })
      .from(projectLogs)
      .where(eq(projectLogs.projectId, projectId))
      .orderBy(desc(projectLogs.createdAt))
      .limit(limit)

    return new Response(JSON.stringify({ logs }), { status: 200 })
  } catch (error) {
    console.error("[Database/Logs] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch logs" }), { status: 500 })
  }
}

// DELETE - Clear logs
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params

  try {
    await db.delete(projectLogs).where(eq(projectLogs.projectId, projectId))

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("[Database/Logs/Clear] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to clear logs" }), { status: 500 })
  }
}
