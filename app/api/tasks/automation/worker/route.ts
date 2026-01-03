import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projectTasks, taskAutomation, messages } from "@/config/schema"
import { eq, and, asc } from "drizzle-orm"

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400 })
    }

    // Get automation settings
    const [automation] = await db
      .select()
      .from(taskAutomation)
      .where(and(eq(taskAutomation.projectId, projectId), eq(taskAutomation.userId, userId)))

    if (!automation || !automation.isActive) {
      return new Response(JSON.stringify({ error: "Automation not active" }), { status: 400 })
    }

    // Check if enough time has passed since last run
    const now = new Date()
    if (automation.lastRunAt) {
      const timeSinceLastRun = now.getTime() - automation.lastRunAt.getTime()
      const intervalMs = automation.intervalMinutes * 60 * 1000
      if (timeSinceLastRun < intervalMs) {
        return new Response(
          JSON.stringify({
            message: "Not enough time passed",
            nextRunIn: intervalMs - timeSinceLastRun,
          }),
          { status: 200 },
        )
      }
    }

    // Get next pending task
    const [nextTask] = await db
      .select()
      .from(projectTasks)
      .where(
        and(eq(projectTasks.projectId, projectId), eq(projectTasks.userId, userId), eq(projectTasks.status, "pending")),
      )
      .orderBy(asc(projectTasks.orderIndex))
      .limit(1)

    if (!nextTask) {
      return new Response(JSON.stringify({ message: "No pending tasks" }), { status: 200 })
    }

    // Insert message into chat
    await db.insert(messages).values({
      projectId,
      role: "user",
      content: `${nextTask.title}\n\n${nextTask.description}`,
      isAutomated: true,
    })

    // Update task status
    await db.update(projectTasks).set({ status: "completed" }).where(eq(projectTasks.id, nextTask.id))

    // Update automation last run time
    await db
      .update(taskAutomation)
      .set({ lastRunAt: now, nextTaskId: nextTask.id })
      .where(eq(taskAutomation.id, automation.id))

    return new Response(
      JSON.stringify({
        success: true,
        taskId: nextTask.id,
        taskTitle: nextTask.title,
      }),
      { status: 200 },
    )
  } catch (error) {
    console.error("Failed to process automation:", error)
    return new Response(JSON.stringify({ error: "Failed to process automation" }), { status: 500 })
  }
}
