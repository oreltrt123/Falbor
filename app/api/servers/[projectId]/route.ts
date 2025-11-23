import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/config/db"
import { serverConnections } from "@/config/schema"
import { eq, and } from "drizzle-orm"

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params

    const [connection] = await db
      .select()
      .from(serverConnections)
      .where(and(eq(serverConnections.projectId, projectId), eq(serverConnections.isActive, true)))
      .limit(1)

    console.log("[v0] Fetched connection for project:", projectId, connection ? "Found" : "Not found")

    return NextResponse.json({
      connection: connection || null,
    })
  } catch (error) {
    console.error("[v0] Get server connection error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch server connection" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params

    await db
      .update(serverConnections)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(serverConnections.projectId, projectId), eq(serverConnections.isActive, true)))

    console.log("[v0] Disconnected server for project:", projectId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete server connection error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect server" },
      { status: 500 },
    )
  }
}
