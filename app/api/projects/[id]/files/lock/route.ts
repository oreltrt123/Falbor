import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { files, projects } from "@/config/schema"
import { eq, and } from "drizzle-orm"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await req.json()
    const { path, isLocked } = body

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    await db
      .update(files)
      .set({ isLocked, updatedAt: new Date() })
      .where(and(eq(files.projectId, projectId), eq(files.path, path)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Toggle lock error:", error)
    return NextResponse.json({ error: "Failed to toggle lock" }, { status: 500 })
  }
}
