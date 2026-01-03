import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { taskAutomation } from "@/config/schema"
import { eq, and } from "drizzle-orm"

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400 })
  }

  try {
    const [automation] = await db
      .select()
      .from(taskAutomation)
      .where(and(eq(taskAutomation.projectId, projectId), eq(taskAutomation.userId, userId)))

    if (!automation) {
      return new Response(JSON.stringify({ isActive: false, intervalMinutes: 10 }), { status: 200 })
    }

    return new Response(JSON.stringify(automation), { status: 200 })
  } catch (error) {
    console.error("Failed to fetch automation:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch automation" }), { status: 500 })
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId, isActive, intervalMinutes } = body

    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400 })
    }

    const [existing] = await db
      .select()
      .from(taskAutomation)
      .where(and(eq(taskAutomation.projectId, projectId), eq(taskAutomation.userId, userId)))

    if (existing) {
      const [updated] = await db
        .update(taskAutomation)
        .set({ isActive, intervalMinutes, updatedAt: new Date() })
        .where(eq(taskAutomation.id, existing.id))
        .returning()

      return new Response(JSON.stringify(updated), { status: 200 })
    } else {
      const [created] = await db
        .insert(taskAutomation)
        .values({
          projectId,
          userId,
          isActive,
          intervalMinutes,
        })
        .returning()

      return new Response(JSON.stringify(created), { status: 201 })
    }
  } catch (error) {
    console.error("Failed to update automation:", error)
    return new Response(JSON.stringify({ error: "Failed to update automation" }), { status: 500 })
  }
}
