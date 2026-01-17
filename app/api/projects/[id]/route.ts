// app/api/projects/[id]/route.ts

import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, projectShares } from "@/config/schema"
import { eq, and } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { randomBytes } from "crypto"

/* ----------------------------------------
   GET: Fetch single project
---------------------------------------- */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const project = await db
      .select({
        id: projects.id,
        title: projects.title,
        description: projects.description,
        coverImage: projects.coverImage,
        isPublic: projects.isPublic,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    if (project.length === 0) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
    }

    return new Response(JSON.stringify(project[0]), { status: 200 })
  } catch (error) {
    console.error("[API/Projects/Get] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch project" }), { status: 500 })
  }
}

/* ----------------------------------------
   PATCH: Update project
---------------------------------------- */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { description, coverImage, isPublic, selectedModel } = body

    const updates: any = { updatedAt: new Date() }
    if (description !== undefined) updates.description = description
    if (coverImage !== undefined) updates.coverImage = coverImage
    if (isPublic !== undefined) updates.isPublic = isPublic
    if (selectedModel !== undefined) updates.selectedModel = selectedModel

    const result = await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning()

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("[API/Projects/Update] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to update project" }), { status: 500 })
  }
}

/* ----------------------------------------
   DELETE: Delete project
---------------------------------------- */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const result = await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning()

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("[API/Projects/Delete] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to delete project" }), { status: 500 })
  }
}

/* ----------------------------------------
   POST: Share project (NEW FEATURE)
---------------------------------------- */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const { id: projectId } = await params

    // Ensure project belongs to user
    const ownedProject = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    if (ownedProject.length === 0) {
      return new Response(
        JSON.stringify({ error: "Project not found or not owned" }),
        { status: 403 }
      )
    }

    // Generate secure token
    const shareToken = randomBytes(16).toString("hex")

    // Save share token
    await db.insert(projectShares).values({
      projectId,
      ownerId: userId,
      shareToken,
      createdAt: new Date(),
    })

    return new Response(JSON.stringify({ shareToken }), { status: 200 })
  } catch (error) {
    console.error("[API/Projects/Share] Error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    )
  }
}
