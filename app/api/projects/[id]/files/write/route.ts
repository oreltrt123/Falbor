import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, files } from "@/config/schema"
import { eq } from "drizzle-orm"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Destructure and rename for consistency with your schema/variables
    const { id: projectId } = await params
    const { filesData } = await req.json()

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 403 })
    }

    // Delete existing files and insert new ones
    await db.delete(files).where(eq(files.projectId, projectId))

    for (const file of filesData) {
      await db.insert(files).values({
        projectId,
        path: file.path,
        content: file.content,
        language: file.language || "plaintext",
      })
    }

    console.log(`[v0] Wrote ${filesData.length} files for project ${projectId}`)

    return NextResponse.json({ success: true, count: filesData.length })
  } catch (error) {
    console.error("[v0] Failed to write files:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write files" },
      { status: 500 },
    )
  }
}