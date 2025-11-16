import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/config/db"
import { projects, messages } from "@/config/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const userProjects = await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(projects.createdAt)

    return NextResponse.json({ projects: userProjects })
  } catch (error) {
    console.error("[Projects API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { message, model = "gemini", isAutomated = false } = await request.json() // New: isAutomated

    const [project] = await db
      .insert(projects)
      .values({
        userId,
        title: message.slice(0, 50),
        selectedModel: model,
        isAutomated, // New
      })
      .returning()

    await db.insert(messages).values({
      projectId: project.id,
      role: "user",
      content: message,
      isAutomated, // New
    })

    // Removed hardcoded assistant message; let /api/chat generate the real AI response

    return NextResponse.json({ projectId: project.id })
  } catch (error) {
    console.error("[Projects API] Error:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}