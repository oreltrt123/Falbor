/**
 * Supabase Management API Client
 * Automatically provisions Supabase projects for AI-generated websites
 */

import crypto from "crypto"

const SUPABASE_API_URL = "https://api.supabase.com/v1"

interface CreateProjectParams {
  name: string
  organizationSlug: string
  region?: string
}

interface SupabaseProject {
  id: string
  organization_id: string
  name: string
  region: string
  created_at: string
  database: {
    host: string
    version: string
  }
}

interface ProjectApiKeys {
  anon_key: string
  service_role_key: string
}

interface SupabaseProjectCredentials {
  projectRef: string
  supabaseUrl: string
  anonKey: string
  serviceRoleKey: string
  dbPassword: string
  region: string
}

/**
 * Generate a secure database password
 */
function generateSecurePassword(): string {
  const length = 32
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
  const randomBytes = crypto.randomBytes(length)
  let password = ""
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length]
  }
  return password
}

/**
 * Create a new Supabase project via Management API
 */
export async function createSupabaseProject(params: CreateProjectParams): Promise<SupabaseProjectCredentials> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is not configured. Generate a Personal Access Token at https://supabase.com/dashboard/account/tokens",
    )
  }

  const dbPassword = generateSecurePassword()

  // Create the project
  const createResponse = await fetch(`${SUPABASE_API_URL}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      organization_id: params.organizationSlug,
      db_pass: dbPassword,
      region: params.region || "us-east-1",
      plan: "free",
    }),
  })

  if (!createResponse.ok) {
    const error = await createResponse.text()
    throw new Error(`Failed to create Supabase project: ${error}`)
  }

  const project: SupabaseProject = await createResponse.json()

  // Wait for project to be ready (poll health endpoint)
  await waitForProjectReady(project.id, accessToken)

  // Get API keys
  const keysResponse = await fetch(`${SUPABASE_API_URL}/projects/${project.id}/api-keys`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!keysResponse.ok) {
    throw new Error("Failed to retrieve API keys")
  }

  const keys: { name: string; api_key: string }[] = await keysResponse.json()
  const anonKey = keys.find((k) => k.name === "anon")?.api_key || ""
  const serviceRoleKey = keys.find((k) => k.name === "service_role")?.api_key || ""

  return {
    projectRef: project.id,
    supabaseUrl: `https://${project.id}.supabase.co`,
    anonKey,
    serviceRoleKey,
    dbPassword,
    region: project.region,
  }
}

/**
 * Poll project health until ready
 */
async function waitForProjectReady(projectRef: string, accessToken: string): Promise<void> {
  const maxAttempts = 60 // 5 minutes max
  const delayMs = 5000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const healthResponse = await fetch(`${SUPABASE_API_URL}/projects/${projectRef}/health`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (healthResponse.ok) {
      const health = await healthResponse.json()
      const allHealthy = health.every((service: { status: string }) => service.status === "ACTIVE_HEALTHY")

      if (allHealthy) {
        return
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error("Timeout waiting for Supabase project to be ready")
}

/**
 * Run SQL migrations on a Supabase project
 */
export async function runMigration(projectRef: string, sql: string): Promise<{ success: boolean; error?: string }> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is not configured")
  }

  const response = await fetch(`${SUPABASE_API_URL}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    const error = await response.text()
    return { success: false, error }
  }

  return { success: true }
}

/**
 * Get tables from a Supabase project
 */
export async function getProjectTables(projectRef: string): Promise<any[]> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is not configured")
  }

  const sql = `
    SELECT 
      table_name,
      table_schema
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `

  const response = await fetch(`${SUPABASE_API_URL}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return data
}

/**
 * Get table columns from a Supabase project
 */
export async function getTableColumns(projectRef: string, tableName: string): Promise<any[]> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is not configured")
  }

  const sql = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = '${tableName}'
    ORDER BY ordinal_position;
  `

  const response = await fetch(`${SUPABASE_API_URL}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return data
}

/**
 * Get users from auth.users table
 */
export async function getProjectUsers(projectRef: string): Promise<any[]> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is not configured")
  }

  const sql = `
    SELECT 
      id,
      email,
      raw_user_meta_data->>'name' as name,
      role,
      created_at,
      last_sign_in_at
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 100;
  `

  const response = await fetch(`${SUPABASE_API_URL}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return data
}
