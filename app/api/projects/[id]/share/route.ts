import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { randomBytes } from "crypto"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    const projects = await sql`
      SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}
    `

    if (projects.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const existing = await sql`
      SELECT * FROM project_shares WHERE project_id = ${id}
    `

    if (existing.length > 0) {
      return NextResponse.json({ shareToken: existing[0].share_token })
    }

    const shareToken = randomBytes(16).toString("hex")

    await sql`
      INSERT INTO project_shares (project_id, owner_id, share_token)
      VALUES (${id}, ${userId}, ${shareToken})
    `

    return NextResponse.json({ shareToken })
  } catch (error) {
    console.error("[Share POST] Error:", error)
    return NextResponse.json({ error: "Failed to generate link" }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

    const shares = await sql`
      SELECT * FROM project_shares WHERE project_id = ${id}
    `

    if (shares.length === 0) {
      return NextResponse.json({ shareToken: null })
    }

    return NextResponse.json({ shareToken: shares[0].share_token })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch share" }, { status: 500 })
  }
}
