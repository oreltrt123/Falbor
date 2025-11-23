import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/config/db"
import { serverConnections } from "@/config/schema"

export async function POST(request: NextRequest) {
  try {
    const { projectId, provider, accessToken, projectName } = await request.json()

    console.log("[v0] Connecting to Supabase project:", projectName)

    const authHeader = request.headers.get("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    // For demo purposes, use token as userId
    const userId = token || "demo-user"

    const supabaseApiUrl = `https://api.supabase.com/v1/projects/${projectName}`

    const verifyResponse = await fetch(supabaseApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!verifyResponse.ok) {
      console.error("[v0] Supabase verification failed:", verifyResponse.status)
      return NextResponse.json(
        { error: "Invalid Supabase credentials. Please check your project name and access token." },
        { status: 401 },
      )
    }

    const projectData = await verifyResponse.json()
    console.log("[v0] Supabase project verified:", projectData.name)

    const [connection] = await db
      .insert(serverConnections)
      .values({
        projectId,
        userId,
        provider,
        accessToken,
        projectRef: projectData.id,
        projectName: projectData.name,
        databaseUrl: projectData.database?.host || null,
        apiUrl: projectData.endpoint || null,
        isActive: true,
        schema: null,
      })
      .returning()

    console.log("[v0] Server connection created:", connection.id)

    try {
      const schemaResponse = await fetch(`${request.nextUrl.origin}/api/servers/${projectId}/schema`, {
        method: "POST",
        headers: {
          Authorization: authHeader || "",
        },
      })

      if (schemaResponse.ok) {
        const schemaData = await schemaResponse.json()
        connection.schema = schemaData.schema
      }
    } catch (error) {
      console.warn("[v0] Failed to fetch initial schema:", error)
    }

    return NextResponse.json({
      connection: {
        id: connection.id,
        provider: connection.provider,
        providerProjectName: connection.projectName,
        isActive: connection.isActive,
        schema: connection.schema,
      },
    })
  } catch (error) {
    console.error("[v0] Server connect error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect server" },
      { status: 500 },
    )
  }
}
