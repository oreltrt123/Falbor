import { type NextRequest, NextResponse } from "next/server"
import { sql, getOrCreateProjectDatabase, addDatabaseLog } from "@/config/db"

// GET - Get project database info and stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    // Get or create database
    const database = await getOrCreateProjectDatabase(projectId)

    // Get stats
    const [userCount] = await sql`
      SELECT COUNT(*) as count FROM project_users WHERE project_database_id = ${database.id}
    `

    const [tableCount] = await sql`
      SELECT COUNT(*) as count FROM project_tables WHERE project_database_id = ${database.id}
    `

    return NextResponse.json({
      database,
      stats: {
        users: Number.parseInt(userCount.count),
        tables: Number.parseInt(tableCount.count),
      },
    })
  } catch (error) {
    console.error("[Database API] Error:", error)
    return NextResponse.json({ error: "Failed to get database info" }, { status: 500 })
  }
}

// POST - Initialize database with default tables
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { tables } = body

    // Get or create database
    const database = await getOrCreateProjectDatabase(projectId)

    // Create default users table if requested
    if (tables?.includes("users")) {
      const existingUsers = await sql`
        SELECT * FROM project_tables 
        WHERE project_database_id = ${database.id} AND table_name = 'users'
      `

      if (existingUsers.length === 0) {
        await sql`
          INSERT INTO project_tables (project_database_id, table_name, columns)
          VALUES (${database.id}, 'users', ${JSON.stringify([
            { name: "email", type: "text", nullable: false },
            { name: "name", type: "text", nullable: true },
            { name: "role", type: "text", nullable: false },
            { name: "password_hash", type: "text", nullable: true },
          ])})
        `

        await addDatabaseLog(database.id, "success", "Created users table")
      }
    }

    return NextResponse.json({ success: true, database })
  } catch (error) {
    console.error("[Database API] Error:", error)
    return NextResponse.json({ error: "Failed to initialize database" }, { status: 500 })
  }
}