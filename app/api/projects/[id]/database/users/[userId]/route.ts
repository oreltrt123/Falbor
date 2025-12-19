import { type NextRequest, NextResponse } from "next/server"
import { sql, getOrCreateProjectDatabase, addDatabaseLog } from "@/config/db"

// GET - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: projectId, userId } = await params
    const database = await getOrCreateProjectDatabase(projectId)

    const users = await sql`
      SELECT id, email, name, role, created_at, updated_at
      FROM project_users 
      WHERE project_database_id = ${database.id} AND id = ${userId}
    `

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user: users[0] })
  } catch (error) {
    console.error("[Database User API] Error:", error)
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 })
  }
}

// PATCH - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: projectId, userId } = await params
    const body = await request.json()
    const { name, role } = body

    const database = await getOrCreateProjectDatabase(projectId)

    const result = await sql`
      UPDATE project_users 
      SET 
        name = COALESCE(${name}, name),
        role = COALESCE(${role}, role),
        updated_at = NOW()
      WHERE project_database_id = ${database.id} AND id = ${userId}
      RETURNING id, email, name, role, created_at, updated_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await addDatabaseLog(database.id, "info", `User updated: ${result[0].email}`, { userId, changes: body })

    return NextResponse.json({ user: result[0] })
  } catch (error) {
    console.error("[Database User API] Error:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: projectId, userId } = await params
    const database = await getOrCreateProjectDatabase(projectId)

    const result = await sql`
      DELETE FROM project_users 
      WHERE project_database_id = ${database.id} AND id = ${userId}
      RETURNING email
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await addDatabaseLog(database.id, "warn", `User deleted: ${result[0].email}`, { userId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Database User API] Error:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}