// app/api/projects/[id]/share/route.ts
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { randomBytes } from "crypto"

type ShareRole = "viewer" | "editor" | "admin"

// GET - Fetch all share links for a project
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

    // Verify ownership
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get all share links for this project
    const shares = await sql`
      SELECT 
        id, 
        share_token, 
        role, 
        label, 
        is_active, 
        usage_count, 
        max_uses, 
        created_at, 
        expires_at
      FROM project_shares 
      WHERE project_id = ${id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ shares })
  } catch (error) {
    console.error("[Share GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch shares" }, { status: 500 })
  }
}

// POST - Create a new share link with specified role
export async function POST(
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
    const role: ShareRole = body.role || "viewer"
    const label: string | null = body.label || null
    const maxUses: number | null = body.maxUses || null
    const expiresAt: string | null = body.expiresAt || null

    // Validate role
    if (!["viewer", "editor", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Verify ownership
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Generate a unique share token
    const shareToken = randomBytes(16).toString("hex")

    // Create the share link
    const result = await sql`
      INSERT INTO project_shares (project_id, owner_id, share_token, role, label, max_uses, expires_at)
      VALUES (${id}, ${userId}, ${shareToken}, ${role}, ${label}, ${maxUses}, ${expiresAt ? new Date(expiresAt) : null})
      RETURNING id, share_token, role, label, is_active, usage_count, max_uses, created_at, expires_at
    `

    return NextResponse.json({ share: result[0] })
  } catch (error) {
    console.error("[Share POST] Error:", error)
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 })
  }
}

// PATCH - Update a share link (toggle active, change role, etc.)
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
    const { shareId, isActive, role, label } = body

    if (!shareId) {
      return NextResponse.json({ error: "Share ID required" }, { status: 400 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Verify ownership
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (typeof isActive === "boolean") {
      updates.push("is_active")
      values.push(isActive)
    }
    if (role && ["viewer", "editor", "admin"].includes(role)) {
      updates.push("role")
      values.push(role)
    }
    if (label !== undefined) {
      updates.push("label")
      values.push(label)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 })
    }

    // Update the share
    const result = await sql`
      UPDATE project_shares 
      SET 
        is_active = COALESCE(${typeof isActive === "boolean" ? isActive : null}, is_active),
        role = COALESCE(${role || null}, role),
        label = COALESCE(${label !== undefined ? label : null}, label)
      WHERE id = ${shareId} AND project_id = ${id}
      RETURNING id, share_token, role, label, is_active, usage_count, max_uses, created_at, expires_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 })
    }

    return NextResponse.json({ share: result[0] })
  } catch (error) {
    console.error("[Share PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update share" }, { status: 500 })
  }
}

// DELETE - Remove a share link
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
    const shareId = searchParams.get("shareId")

    if (!shareId) {
      return NextResponse.json({ error: "Share ID required" }, { status: 400 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Verify ownership
    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Delete the share link
    await sql`
      DELETE FROM project_shares 
      WHERE id = ${shareId} AND project_id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Share DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete share" }, { status: 500 })
  }
}
