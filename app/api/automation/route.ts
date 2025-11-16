import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/config/db"
import { userAutomations } from "@/config/schema"
import { eq } from "drizzle-orm"
import { calculateNextRunTime } from "@/lib/common/prompts/automation-schedule"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [automation] = await db.select().from(userAutomations).where(eq(userAutomations.userId, userId))
    return NextResponse.json(automation || {
      userId,
      selectedModel: "gemini",
      maxMessages: 2,
      isActive: false,
      activatedAt: null,
      nextRunAt: null,
    })
  } catch (error) {
    console.error("[Automation API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { selectedModel, maxMessages, isActive } = body

    // When activating, set the activation time and calculate next run
    let activatedAt = null
    let nextRunAt = null
    
    if (isActive) {
      activatedAt = new Date()
      nextRunAt = calculateNextRunTime(activatedAt)
    }

    // Upsert automation record
    await db.insert(userAutomations).values({
      userId,
      selectedModel: selectedModel || "gemini",
      maxMessages: Math.max(maxMessages || 2, 2),
      isActive,
      activatedAt,
      nextRunAt,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: userAutomations.userId,
      set: {
        selectedModel: selectedModel || "gemini",
        maxMessages: Math.max(maxMessages || 2, 2),
        isActive,
        activatedAt,
        nextRunAt,
        updatedAt: new Date(),
      }
    })

    const [updated] = await db.select().from(userAutomations).where(eq(userAutomations.userId, userId))
    return NextResponse.json(updated)
  } catch (error) {
    console.error("[Automation API] Error:", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
