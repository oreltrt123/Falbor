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
    const { projectId, taskId, error } = body

    if (!projectId || !taskId || !error) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    // Insert fix message into chat
    const fixMessage = `Please fix this error from a previous task:\n\nError: ${error}\n\nPlease analyze the issue and provide a fix.`

    await db.insert(messages).values({
      projectId,
      role: "user",
      content: fixMessage,
      isAutomated: false,
    })

    // Update task status back to pending
    await db
      .update(projectTasks)
      .set({ status: "pending", errorMessage: null })
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.userId, userId)))

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("Failed to send fix request:", error)
    return new Response(JSON.stringify({ error: "Failed to send fix request" }), { status: 500 })
  }
}
