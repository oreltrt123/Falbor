import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { clerkClient } from "@clerk/nextjs/server"

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    const shares = await sql`
      SELECT ps.*, p.title, p.is_public, p.user_id AS owner_id
      FROM project_shares ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.share_token = ${token}
    `

    if (shares.length === 0) {
      return NextResponse.json({ error: "Invalid link" }, { status: 404 })
    }

    const share = shares[0]

    let ownerName = "Project Owner"
    let ownerImage = "/placeholder.svg"

    try {
      const clerk = await clerkClient()
      const owner = await clerk.users.getUser(share.owner_id)
      ownerName = owner.firstName || owner.username || ownerName
      ownerImage = owner.imageUrl || ownerImage
    } catch {}

    return NextResponse.json({
      projectId: share.project_id,
      projectTitle: share.title,
      ownerName,
      ownerImage,
      isPublic: share.is_public,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to load share" }, { status: 500 })
  }
}
