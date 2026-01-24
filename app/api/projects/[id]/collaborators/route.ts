// app/api/projects/[id]/collaborators/route.ts
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

type CollaboratorRole = "viewer" | "editor" | "admin"

// GET - Fetch all collaborators for a project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Check if user is owner or collaborator
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    const isOwner = projects.length > 0

    if (!isOwner) {
      // Check if user is a collaborator
      const collab = await sql`
        SELECT * FROM project_collaborators 
        WHERE project_id = ${id} AND user_id = ${userId} AND status = 'accepted'
      `
      if (collab.length === 0) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Get all collaborators for this project
    const collaborators = await sql`
      SELECT 
        id, 
        user_id, 
        invited_by,
        role, 
        status, 
        display_name,
        image_url,
        joined_at,
        last_accessed_at,
        created_at
      FROM project_collaborators 
      WHERE project_id = ${id} AND status = 'accepted'
      ORDER BY joined_at DESC
    `

    return NextResponse.json({ collaborators, isOwner })
  } catch (error) {
    console.error("[Collaborators GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch collaborators" }, { status: 500 })
  }
}

// PATCH - Update a collaborator's role or status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { collaboratorId, role, status } = body

    if (!collaboratorId) {
      return NextResponse.json({ error: "Collaborator ID required" }, { status: 400 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Verify ownership (only owner can change collaborator roles)
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Only project owner can modify collaborators" }, { status: 403 })
    }

    // Validate role if provided
    if (role && !["viewer", "editor", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Update the collaborator
    const result = await sql`
      UPDATE project_collaborators 
      SET 
        role = COALESCE(${role || null}, role),
        status = COALESCE(${status || null}, status),
        updated_at = NOW()
      WHERE id = ${collaboratorId} AND project_id = ${id}
      RETURNING id, user_id, role, status, display_name, image_url, joined_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Collaborator not found" }, { status: 404 })
    }

    return NextResponse.json({ collaborator: result[0] })
  } catch (error) {
    console.error("[Collaborators PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update collaborator" }, { status: 500 })
  }
}

// DELETE - Remove a collaborator from the project
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const collaboratorId = searchParams.get("collaboratorId")

    if (!collaboratorId) {
      return NextResponse.json({ error: "Collaborator ID required" }, { status: 400 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Verify ownership
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Only project owner can remove collaborators" }, { status: 403 })
    }

    // Delete the collaborator (or mark as revoked)
    await sql`
      UPDATE project_collaborators 
      SET status = 'revoked', updated_at = NOW()
      WHERE id = ${collaboratorId} AND project_id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Collaborators DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 })
  }
}
