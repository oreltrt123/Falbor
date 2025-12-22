// File: app/api/projects/[id]/database/api-key/route.ts
import { NextResponse, NextRequest } from "next/server"  // Combined import
import { getOrCreateApiKey } from "@/config/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  try {
    const apiKey = await getOrCreateApiKey(projectId)
    const publicBaseUrl = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/public/${projectId}/${apiKey}`

    return NextResponse.json({
      apiKey,
      publicBaseUrl,
      message: "Use this URL in generated sites for database access",
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 })
  }
}