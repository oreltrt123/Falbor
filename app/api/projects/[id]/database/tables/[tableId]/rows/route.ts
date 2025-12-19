import { type NextRequest, NextResponse } from "next/server"
import { sql, getOrCreateProjectDatabase, addDatabaseLog } from "@/config/db"

// GET - Get all rows for table
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
    console.error("[Database Rows API] Error:", error)
    return NextResponse.json({ error: "Failed to get rows" }, { status: 500 })
  }
}

// POST - Create new row
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  try {
    const { id: projectId, tableId } = await params
    const body = await request.json()
    const { data } = body

    const database = await getOrCreateProjectDatabase(projectId)

    const result = await sql`
      INSERT INTO project_table_rows (project_table_id, data)
      VALUES (${tableId}, ${JSON.stringify(data || {})})
      RETURNING *
    `

    await addDatabaseLog(database.id, "info", "Row inserted", { tableId, data })

    return NextResponse.json({ row: result[0] })
  } catch (error) {
    console.error("[Database Rows API] Error:", error)
    return NextResponse.json({ error: "Failed to create row" }, { status: 500 })
  }
}