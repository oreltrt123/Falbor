import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { clerkClient } from "@clerk/nextjs/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Check if user has access to this project
    const access = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
      UNION
      SELECT p.* FROM projects p
      JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${id} AND pc.user_id = ${userId} AND pc.status = 'accepted'
    `

    if (access.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all collaborators
    const collaborators = await sql`
      SELECT 
        pc.*,
        p.user_id as owner_id
      FROM project_collaborators pc
      JOIN projects p ON pc.project_id = p.id
      WHERE pc.project_id = ${id}
      ORDER BY pc.created_at DESC
    `

    // Enrich with Clerk user data
    const clerk = await clerkClient()
    const enrichedCollaborators = await Promise.all(
      collaborators.map(async (collab: any) => {
        try {
          const user = await clerk.users.getUser(collab.user_id)
          return {
            ...collab,
            userName: user.firstName || user.username || "User",
            userImage: user.imageUrl,
          }
        } catch {
          return {
            ...collab,
            userName: "Unknown User",
            userImage: "/abstract-geometric-shapes.png",
          }
        }
      }),
    )

    return NextResponse.json({ collaborators: enrichedCollaborators })
  } catch (error) {
    console.error("[v0] Collaborators fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch collaborators" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { collaboratorUserId } = await req.json()

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Verify ownership
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Only project owner can remove collaborators" }, { status: 403 })
    }

    await sql`
      DELETE FROM project_collaborators
      WHERE project_id = ${id} AND user_id = ${collaboratorUserId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Remove collaborator error:", error)
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 })
  }
}
