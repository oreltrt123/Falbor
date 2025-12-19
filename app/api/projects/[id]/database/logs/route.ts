import { type NextRequest, NextResponse } from "next/server"
import { sql, getOrCreateProjectDatabase } from "@/config/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const db = await getOrCreateProjectDatabase(projectId)
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100")

    const logs = await sql`
      SELECT * FROM project_database_logs 
      WHERE project_database_id = ${db.id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json({ logs })
  } catch (error) {
    console.error("[Database Logs GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const db = await getOrCreateProjectDatabase(projectId)

    await sql`DELETE FROM project_database_logs WHERE project_database_id = ${db.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Database Logs DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to clear logs" }, { status: 500 })
  }
}