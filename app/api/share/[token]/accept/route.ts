import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projectShares, projects, projectCollaborators } from "@/config/schema"
import { eq, and } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { token } = await params

  // 1. Find share link
  const share = await db
    .select()
    .from(projectShares)
    .where(eq(projectShares.shareToken, token))
    .limit(1)

  if (!share.length) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
  }

  const projectId = share[0].projectId
  const ownerId = share[0].ownerId

  // 2. Ensure project exists
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project.length) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  // 3. Check if user is already a collaborator
  const existing = await db
    .select()
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId)
      )
    )
    .limit(1)

  if (!existing.length) {
    await db.insert(projectCollaborators).values({
      projectId,
      userId,
      invitedBy: ownerId,
      role: "viewer",
      status: "accepted",
      joinedAt: new Date(),
      createdAt: new Date(),
    })
  }

  // 4. Redirect to chat
  return NextResponse.json({
    success: true,
    projectId,
    redirectTo: `/chat/${projectId}`,
  })
}
