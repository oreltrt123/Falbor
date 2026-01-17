import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { deployments, projects } from "@/config/schema"
import { eq, and } from "drizzle-orm"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get existing deployment
    const [deployment] = await db.select().from(deployments).where(eq(deployments.projectId, projectId)).limit(1)

    return NextResponse.json({ deployment: deployment || null })
  } catch (error) {
    console.error("[GET_DEPLOYMENT]", error)
    return NextResponse.json({ error: "Failed to get deployment" }, { status: 500 })
  }
}
