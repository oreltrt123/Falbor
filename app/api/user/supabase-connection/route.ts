// app/api/user/supabase-connection/route.ts
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

    const { accessToken, selectedProjectRef, selectedProjectName, supabaseUrl, anonKey } = await request.json()

    if (!accessToken || typeof accessToken !== "string" || !accessToken.startsWith("sbp_")) {
      return NextResponse.json(
        { error: "Invalid or missing Supabase personal access token" },
        { status: 400 }
      )
    }

    if (!selectedProjectRef || !selectedProjectName || !supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Missing required connection details" },
        { status: 400 }
      )
    }

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
          selectedProjectRef,
          selectedProjectName,
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
        selectedProjectRef,
        selectedProjectName,
        supabaseUrl,
        anonKey,
        isActive: true,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Supabase project connected successfully",
      connection: {
        projectRef: selectedProjectRef,
        projectName: selectedProjectName,
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

    // Return connection info (including anonKey for modal display)
    return NextResponse.json({
      connected: true,
      connection: {
        projectRef: connection.selectedProjectRef,
        projectName: connection.selectedProjectName,
        supabaseUrl: connection.supabaseUrl,
        anonKey: connection.anonKey,
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