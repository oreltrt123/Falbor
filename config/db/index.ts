// File: config/db.ts

import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import * as schema from "../schema"
import crypto from "crypto"

if (!process.env.NEON_NEON_DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

export const sql = neon(process.env.NEON_NEON_DATABASE_URL)
export const db = drizzle(sql, { schema })

// Types (unchanged)
export interface ProjectDatabase {
  id: string
  project_id: string
  api_key?: string | null
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

// Helper: Get or create project database (unchanged logic, just typed better)
export async function getOrCreateProjectDatabase(projectId: string, userEmail?: string): Promise<ProjectDatabase> {
  const existing = await sql`
    SELECT * FROM project_databases WHERE project_id = ${projectId}
  `

  if (existing.length > 0) {
    const dbRecord = existing[0] as ProjectDatabase

    if (userEmail) {
      const existingUsers = await sql`
        SELECT * FROM project_users WHERE project_database_id = ${dbRecord.id} AND email = ${userEmail}
      `

      if (existingUsers.length === 0) {
        console.log("[Database] Creating admin user:", userEmail)
        await sql`
          INSERT INTO project_users (project_database_id, email, name, role)
          VALUES (${dbRecord.id}, ${userEmail}, 'Admin', 'admin')
        `
        await addDatabaseLog(dbRecord.id, "success", `Admin user created: ${userEmail}`)
      }
    }
    return dbRecord
  }

  const result = await sql`
    INSERT INTO project_databases (project_id)
    VALUES (${projectId})
    RETURNING *
  `

  const newDb = result[0] as ProjectDatabase

  await addDatabaseLog(newDb.id, "success", "Database initialized for project")

  if (userEmail) {
    console.log("[Database] Creating admin user for new database:", userEmail)
    await sql`
      INSERT INTO project_users (project_database_id, email, name, role)
      VALUES (${newDb.id}, ${userEmail}, 'Admin', 'admin')
    `
    await addDatabaseLog(newDb.id, "success", `Admin user created: ${userEmail}`)
  }

  return newDb
}

// NEW: Get or create a secure API key for public access
export async function getOrCreateApiKey(projectId: string): Promise<string> {
  const database = await getOrCreateProjectDatabase(projectId)

  if (database.api_key) {
    return database.api_key
  }

  // Generate strong random API key
  const apiKey = crypto.randomBytes(32).toString("hex")

  await sql`
    UPDATE project_databases
    SET api_key = ${apiKey}
    WHERE id = ${database.id}
  `

  await addDatabaseLog(database.id, "success", "API key generated for public access")

  console.log(`[Database] API key created for project ${projectId}: ${apiKey.substring(0, 8)}...`)

  return apiKey
}

// Log helper (unchanged)
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