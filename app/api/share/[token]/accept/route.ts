// app/api/share/[token]/accept/route.ts
import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { token } = await params
    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Find the share link
    const shares = await sql`
      SELECT 
        ps.*,
        p.title,
        p.user_id AS owner_id
      FROM project_shares ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.share_token = ${token}
    `

    if (shares.length === 0) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })
    }

    const share = shares[0]

    // Check if link is still active
    if (!share.is_active) {
      return NextResponse.json({ error: "This link has been deactivated" }, { status: 410 })
    }

    // Check if link has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 })
    }

    // Check if max uses reached
    if (share.max_uses && share.usage_count >= share.max_uses) {
      return NextResponse.json({ error: "This link has reached its usage limit" }, { status: 410 })
    }

    // Check if user is the owner
    if (share.owner_id === userId) {
      return NextResponse.json({
        success: true,
        projectId: share.project_id,
        redirectTo: `/chat/${share.project_id}`,
        message: "You are the owner of this project",
      })
    }

    // Get user info from Clerk for caching
    let displayName = "Unknown User"
    let imageUrl = "/placeholder.svg"

    try {
      const clerk = await clerkClient()
      const user = await clerk.users.getUser(userId)
      displayName = user.firstName || user.username || displayName
      imageUrl = user.imageUrl || imageUrl
    } catch (e) {
      console.error("[Accept] Failed to fetch user info:", e)
    }

    // Check if already a collaborator
    const existing = await sql`
      SELECT * FROM project_collaborators 
      WHERE project_id = ${share.project_id} AND user_id = ${userId}
    `

    if (existing.length > 0) {
      // Update existing collaborator if revoked
      if (existing[0].status === "revoked") {
        await sql`
          UPDATE project_collaborators 
          SET 
            status = 'accepted',
            role = ${share.role},
            share_id = ${share.id},
            display_name = ${displayName},
            image_url = ${imageUrl},
            joined_at = NOW(),
            updated_at = NOW()
          WHERE id = ${existing[0].id}
        `
      } else {
        // Already a collaborator, just update last accessed
        await sql`
          UPDATE project_collaborators 
          SET last_accessed_at = NOW()
          WHERE id = ${existing[0].id}
        `
      }
    } else {
      // Create new collaborator
      await sql`
        INSERT INTO project_collaborators (
          project_id, 
          user_id, 
          invited_by, 
          share_id,
          role, 
          status, 
          display_name,
          image_url,
          joined_at,
          created_at,
          updated_at
        )
        VALUES (
          ${share.project_id}, 
          ${userId}, 
          ${share.owner_id}, 
          ${share.id},
          ${share.role}, 
          'accepted', 
          ${displayName},
          ${imageUrl},
          NOW(),
          NOW(),
          NOW()
        )
      `
    }

    // Increment usage count
    await sql`
      UPDATE project_shares 
      SET usage_count = usage_count + 1
      WHERE id = ${share.id}
    `

    return NextResponse.json({
      success: true,
      projectId: share.project_id,
      role: share.role,
      redirectTo: `/chat/${share.project_id}`,
    })
  } catch (error) {
    console.error("[Accept POST] Error:", error)
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 })
  }
}
