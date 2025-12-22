// File: app/api/public/[projectId]/[apiKey]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/config/db"
import { projectDatabases } from "@/config/schema"

// Validate API key first
async function validateApiKey(projectId: string, apiKey: string) {
  const database = await db.query.projectDatabases.findFirst({
    where: eq(projectDatabases.projectId, projectId),
  })
  return database?.apiKey === apiKey
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; apiKey: string }> }
) {
  const { projectId, apiKey } = await params
  if (!(await validateApiKey(projectId, apiKey))) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  // Forward to internal routes or handle here
  // For simplicity, we'll proxy to internal handlers
  return NextResponse.redirect(
    new URL(`/api/projects/${projectId}/database${request.nextUrl.pathname.replace(`/api/public/${projectId}/${apiKey}`, "")}${request.nextUrl.search}`, request.url)
  )
}

// Support POST, PUT, DELETE the same way
export { GET as POST, GET as PUT, GET as DELETE }