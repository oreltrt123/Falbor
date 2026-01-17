// app/api/supabase/connect/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { userSupabaseConnections } from "@/config/schema"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accessToken, projectRef, projectName } = await request.json()

    if (!accessToken || typeof accessToken !== "string" || !accessToken.startsWith("sbp_")) {
      return NextResponse.json(
        { error: "Invalid or missing Supabase personal access token" },
        { status: 400 }
      )
    }

    if (!projectRef || !projectName) {
      return NextResponse.json(
        { error: "Missing project reference or project name" },
        { status: 400 }
      )
    }

    // Fetch project details from Supabase to get keys
    const projectDetailsResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!projectDetailsResponse.ok) {
      const errorData = await projectDetailsResponse.json().catch(() => ({}))
      console.error("[Supabase API Keys Error]:", projectDetailsResponse.status, errorData)
      
      return NextResponse.json(
        { error: "Failed to fetch project API keys from Supabase" },
        { status: projectDetailsResponse.status }
      )
    }

    const apiKeys = await projectDetailsResponse.json()
    const anonKey = apiKeys.find((key: any) => key.name === "anon")?.api_key
    
    if (!anonKey) {
      return NextResponse.json(
        { error: "Could not find anon key for project" },
        { status: 400 }
      )
    }

    const supabaseUrl = `https://${projectRef}.supabase.co`

    // Check if connection already exists
    const [existingConnection] = await db
      .select()
      .from(userSupabaseConnections)
      .where(eq(userSupabaseConnections.userId, userId))
      .limit(1)

    if (existingConnection) {
      // Update existing connection
      await db
        .update(userSupabaseConnections)
        .set({
          accessToken,
          selectedProjectRef: projectRef,
          selectedProjectName: projectName,
          supabaseUrl,
          anonKey,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(userSupabaseConnections.userId, userId))
    } else {
      // Create new connection
      await db.insert(userSupabaseConnections).values({
        userId,
        accessToken,
        selectedProjectRef: projectRef,
        selectedProjectName: projectName,
        supabaseUrl,
        anonKey,
        isActive: true,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Supabase project connected successfully",
      connection: {
        projectRef,
        projectName,
        supabaseUrl,
      }
    })

  } catch (error: any) {
    console.error("[Supabase Connect Route Error]:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error while connecting Supabase project" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's current Supabase connection
    const [connection] = await db
      .select()
      .from(userSupabaseConnections)
      .where(eq(userSupabaseConnections.userId, userId))
      .limit(1)

    if (!connection) {
      return NextResponse.json({ connected: false, connection: null })
    }

    // Return connection info (without sensitive tokens)
    return NextResponse.json({
      connected: true,
      connection: {
        projectRef: connection.selectedProjectRef,
        projectName: connection.selectedProjectName,
        supabaseUrl: connection.supabaseUrl,
        isActive: connection.isActive,
        createdAt: connection.createdAt,
      }
    })

  } catch (error: any) {
    console.error("[Get Supabase Connection Error]:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Deactivate the connection
    await db
      .update(userSupabaseConnections)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(userSupabaseConnections.userId, userId))

    return NextResponse.json({
      success: true,
      message: "Supabase connection disconnected"
    })

  } catch (error: any) {
    console.error("[Disconnect Supabase Error]:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}