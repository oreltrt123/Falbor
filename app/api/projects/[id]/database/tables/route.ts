import { type NextRequest, NextResponse } from "next/server"
import { sql, getOrCreateProjectDatabase, addDatabaseLog } from "@/config/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const db = await getOrCreateProjectDatabase(projectId)

    const tables = await sql`
      SELECT 
        pt.*,
        (SELECT COUNT(*) FROM project_table_rows WHERE project_table_id = pt.id) as row_count
      FROM project_tables pt
      WHERE pt.project_database_id = ${db.id}
      ORDER BY pt.created_at DESC
    `

    return NextResponse.json({ tables })
  } catch (error) {
    console.error("[Database Tables GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const db = await getOrCreateProjectDatabase(projectId)
    const body = await request.json()

    const { table_name, columns } = body

    if (!table_name || !columns) {
      return NextResponse.json({ error: "Table name and columns are required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO project_tables (project_database_id, table_name, columns)
      VALUES (${db.id}, ${table_name}, ${JSON.stringify(columns)})
      RETURNING *
    `

    await addDatabaseLog(db.id, "success", `Table created: ${table_name}`)

    return NextResponse.json({ table: result[0] })
  } catch (error) {
    console.error("[Database Tables POST] Error:", error)
    return NextResponse.json({ error: "Failed to create table" }, { status: 500 })
  }
}