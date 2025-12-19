import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/config/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  try {
    const { tableId } = await params

    const rows = await sql`
      SELECT * FROM project_table_rows 
      WHERE project_table_id = ${tableId}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ rows })
  } catch (error) {
    console.error("[Database Table Rows GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch table rows" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  try {
    const { tableId } = await params

    await sql`DELETE FROM project_tables WHERE id = ${tableId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Database Table DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete table" }, { status: 500 })
  }
}