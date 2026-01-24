// app/api/share/[token]/route.ts
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { clerkClient } from "@clerk/nextjs/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    // Get share link with project info
    const shares = await sql`
      SELECT 
        ps.*,
        p.title,
        p.description,
        p.cover_image,
        p.is_public,
        p.user_id AS owner_id,
        d.deployment_url
      FROM project_shares ps
      JOIN projects p ON ps.project_id = p.id
      LEFT JOIN deployments d ON d.project_id = p.id
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

    // Get owner info from Clerk
    let ownerName = "Project Owner"
    let ownerImage = "/placeholder.svg"

    try {
      const clerk = await clerkClient()
      const owner = await clerk.users.getUser(share.owner_id)
      ownerName = owner.firstName || owner.username || ownerName
      ownerImage = owner.imageUrl || ownerImage
    } catch (e) {
      console.error("[Share GET] Failed to fetch owner info:", e)
    }

    // Get role description
    const roleDescriptions = {
      viewer: "View the project and chat history",
      editor: "View and edit code, send messages in chat",
      admin: "Full access including publishing and settings",
    }

    return NextResponse.json({
      projectId: share.project_id,
      projectTitle: share.title,
      projectDescription: share.description,
      coverImage: share.cover_image,
      ownerName,
      ownerImage,
      isPublic: share.is_public,
      role: share.role,
      roleDescription: roleDescriptions[share.role as keyof typeof roleDescriptions] || roleDescriptions.viewer,
      deploymentUrl: share.deployment_url,
      label: share.label,
    })
  } catch (error) {
    console.error("[Share GET] Error:", error)
    return NextResponse.json({ error: "Failed to load share" }, { status: 500 })
  }
}
