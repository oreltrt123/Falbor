import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import * as schema from "../schema"

if (!process.env.NEON_NEON_DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

export const sql = neon(process.env.NEON_NEON_DATABASE_URL)
export const db = drizzle(sql, { schema })

// Types for project database system
export interface ProjectDatabase {
  id: string
  project_id: string
  created_at: Date
  updated_at: Date
}

export interface ProjectUser {
  id: string
  project_database_id: string
  email: string
  name: string | null
  role: string
  password_hash: string | null
  created_at: Date
  updated_at: Date
}

export interface ProjectTable {
  id: string
  project_database_id: string
  table_name: string
  columns: Array<{ name: string; type: string; nullable?: boolean }>
  created_at: Date
  updated_at: Date
}

export interface ProjectTableRow {
  id: string
  project_table_id: string
  data: Record<string, any>
  created_at: Date
  updated_at: Date
}

export interface ProjectDatabaseLog {
  id: string
  project_database_id: string
  level: "info" | "warn" | "error" | "success"
  message: string
  details: Record<string, any> | null
  created_at: Date
}

// Helper to get or create project database
export async function getOrCreateProjectDatabase(projectId: string, userEmail?: string): Promise<ProjectDatabase> {
  // Check if exists
  const existing = await sql`
    SELECT * FROM project_databases WHERE project_id = ${projectId}
  `

  if (existing.length > 0) {
    if (userEmail) {
      const existingUsers = await sql`
        SELECT * FROM project_users WHERE project_database_id = ${existing[0].id} AND email = ${userEmail}
      `

      if (existingUsers.length === 0) {
        console.log("[Database] Creating admin user:", userEmail)
        await sql`
          INSERT INTO project_users (project_database_id, email, name, role)
          VALUES (${existing[0].id}, ${userEmail}, 'Admin', 'admin')
        `
        await addDatabaseLog(existing[0].id, "success", `Admin user created: ${userEmail}`)
      }
    }
    return existing[0] as ProjectDatabase
  }

  // Create new
  const result = await sql`
    INSERT INTO project_databases (project_id)
    VALUES (${projectId})
    RETURNING *
  `

  // Log creation
  await sql`
    INSERT INTO project_database_logs (project_database_id, level, message)
    VALUES (${result[0].id}, 'success', 'Database initialized for project')
  `

  if (userEmail) {
    console.log("[Database] Creating admin user for new database:", userEmail)
    await sql`
      INSERT INTO project_users (project_database_id, email, name, role)
      VALUES (${result[0].id}, ${userEmail}, 'Admin', 'admin')
    `
    await addDatabaseLog(result[0].id, "success", `Admin user created: ${userEmail}`)
  }

  return result[0] as ProjectDatabase
}

// Log helper
export async function addDatabaseLog(
  projectDatabaseId: string,
  level: "info" | "warn" | "error" | "success",
  message: string,
  details?: Record<string, any>,
) {
  await sql`
    INSERT INTO project_database_logs (project_database_id, level, message, details)
    VALUES (${projectDatabaseId}, ${level}, ${message}, ${details ? JSON.stringify(details) : null})
  `
}
