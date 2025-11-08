import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects } from "@/config/schema"
import { eq, and } from "drizzle-orm"
import type { NextRequest } from "next/server"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const projectId = params.id

  try {
    const body = await request.json()
    const { selectedModel } = body

    if (!selectedModel) {
      return new Response(JSON.stringify({ error: "Missing selectedModel" }), { status: 400 })
    }

    await db
      .update(projects)
      .set({ selectedModel, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("[API/Projects/Update] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to update project" }), { status: 500 })
  }
}
