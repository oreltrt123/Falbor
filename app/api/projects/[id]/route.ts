// app/api/projects/[id]/route.ts
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects } from "@/config/schema"
import { eq, and } from "drizzle-orm"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()  // auth() is sync, no await needed

  console.log('=== API Debug ===')  // Log start
  console.log('User ID from auth:', userId)
  if (!userId) {
    console.log('No userId - returning 401')
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params
  console.log('Project ID from params:', projectId)

  try {
    // First, log all projects for this user (for debugging - remove in prod)
    const allUserProjects = await db
      .select({ id: projects.id, title: projects.title, userId: projects.userId })
      .from(projects)
      .where(eq(projects.userId, userId))
    console.log('All projects for this user:', allUserProjects)

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

    console.log('Specific project query result:', project)

    if (project.length === 0) {
      console.log('No project found - returning 404')
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
    }

    console.log('Success - returning project:', project[0])
    return new Response(JSON.stringify(project[0]), { status: 200 })
  } catch (error) {
    console.error("[API/Projects/Get] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch project" }), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params

  try {
    // Delete the project (cascades to related tables: messages, files, artifacts, etc.)
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