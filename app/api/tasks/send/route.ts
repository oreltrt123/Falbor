import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { messages, projectTasks } from "@/config/schema"
import { eq, and } from "drizzle-orm"

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId, taskId, message } = body

    if (!projectId || !taskId || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    // Insert message into chat
    await db.insert(messages).values({
      projectId,
      role: "user",
      content: message,
      isAutomated: false,
    })

    // Update task status to completed
    await db
      .update(projectTasks)
      .set({ status: "completed" })
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.userId, userId)))

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("Failed to send task:", error)
    return new Response(JSON.stringify({ error: "Failed to send task" }), { status: 500 })
  }
}
