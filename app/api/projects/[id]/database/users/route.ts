import { type NextRequest, NextResponse } from "next/server"
import { sql, getOrCreateProjectDatabase, addDatabaseLog } from "@/config/db"

// GET - Get all users for project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const database = await getOrCreateProjectDatabase(projectId)

    const users = await sql`
      SELECT id, email, name, role, created_at, updated_at
      FROM project_users 
      WHERE project_database_id = ${database.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ users })
  } catch (error) {
    console.error("[Database Users API] Error:", error)
    return NextResponse.json({ error: "Failed to get users" }, { status: 500 })
  }
}

// POST - Create new user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { email, name, role, password_hash } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const database = await getOrCreateProjectDatabase(projectId)

    // Check if user already exists
    const existing = await sql`
      SELECT * FROM project_users 
      WHERE project_database_id = ${database.id} AND email = ${email}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }

    const result = await sql`
      INSERT INTO project_users (project_database_id, email, name, role, password_hash)
      VALUES (${database.id}, ${email}, ${name || null}, ${role || "user"}, ${password_hash || null})
      RETURNING id, email, name, role, created_at, updated_at
    `

    await addDatabaseLog(database.id, "success", `User created: ${email}`, { email, role })

    return NextResponse.json({ user: result[0] })
  } catch (error) {
    console.error("[Database Users API] Error:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}