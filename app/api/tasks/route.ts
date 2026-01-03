import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projectTasks } from "@/config/schema"
import { eq, and, asc } from "drizzle-orm"

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
    const tasks = await db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.projectId, projectId), eq(projectTasks.userId, userId)))
      .orderBy(asc(projectTasks.orderIndex))

    return new Response(JSON.stringify(tasks), { status: 200 })
  } catch (error) {
    console.error("Failed to fetch tasks:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch tasks" }), { status: 500 })
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId, title, description } = body

    if (!projectId || !title || !description) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    const existingTasks = await db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.projectId, projectId), eq(projectTasks.userId, userId)))

    const [newTask] = await db
      .insert(projectTasks)
      .values({
        projectId,
        userId,
        title,
        description,
        orderIndex: existingTasks.length,
        status: "pending",
      })
      .returning()

    return new Response(JSON.stringify(newTask), { status: 201 })
  } catch (error) {
    console.error("Failed to create task:", error)
    return new Response(JSON.stringify({ error: "Failed to create task" }), { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get("taskId")

  if (!taskId) {
    return new Response(JSON.stringify({ error: "Task ID required" }), { status: 400 })
  }

  try {
    await db.delete(projectTasks).where(and(eq(projectTasks.id, taskId), eq(projectTasks.userId, userId)))

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("Failed to delete task:", error)
    return new Response(JSON.stringify({ error: "Failed to delete task" }), { status: 500 })
  }
}
