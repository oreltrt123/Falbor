import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projectTasks } from "@/config/schema"
import { eq, and, asc } from "drizzle-orm"

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { taskId, newIndex } = body

    if (!taskId || newIndex === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    const [task] = await db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.userId, userId)))

    if (!task) {
      return new Response(JSON.stringify({ error: "Task not found" }), { status: 404 })
    }

    // Get all tasks for this project ordered by current index
    const allTasks = await db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.projectId, task.projectId), eq(projectTasks.userId, userId)))
      .orderBy(asc(projectTasks.orderIndex))

    // Update all order indices based on new position
    for (let i = 0; i < allTasks.length; i++) {
      await db
        .update(projectTasks)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(eq(projectTasks.id, allTasks[i].id))
    }

    // Now set the moved task to its new index
    await db
      .update(projectTasks)
      .set({ orderIndex: newIndex, updatedAt: new Date() })
      .where(eq(projectTasks.id, taskId))

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("Failed to reorder task:", error)
    return new Response(JSON.stringify({ error: "Failed to reorder task" }), { status: 500 })
  }
}
