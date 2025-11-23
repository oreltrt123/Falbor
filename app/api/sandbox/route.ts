import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects } from "@/config/schema"
import { eq } from "drizzle-orm"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId } = await req.json()

    // Verify project ownership
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 403 })
    }

    console.log("[v0] WebContainers sandbox request for project:", projectId)

    const previewUrl = `/preview/${projectId}`

    return NextResponse.json({
      previewUrl,
      projectId,
      success: true,
    })
  } catch (error) {
    console.error("[v0] WebContainers sandbox error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create WebContainers environment" },
      { status: 500 },
    )
  }
}
