import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { files, projects } from "@/config/schema"
import { eq, and } from "drizzle-orm"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId))

    const filesByPath = new Map<string, (typeof projectFiles)[0]>()
    for (const file of projectFiles) {
      filesByPath.set(file.path, file)
    }

    const uniqueFiles = Array.from(filesByPath.values())

    return NextResponse.json({
      files: uniqueFiles.map((f) => ({
        id: f.id,
        path: f.path,
        content: f.content,
        language: f.language,
        type: f.type,
        isLocked: f.isLocked,
        additions: f.additions,
        deletions: f.deletions,
      })),
    })
  } catch (error) {
    console.error("[v0] Get files error:", error)
    return NextResponse.json({ error: "Failed to get files" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await req.json()
    const { path, content, language, type } = body

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const [newFile] = await db
      .insert(files)
      .values({
        projectId,
        path,
        content: content || "",
        language: language || "typescript",
        type: type || "file",
      })
      .returning()

    return NextResponse.json({ file: newFile })
  } catch (error) {
    console.error("[v0] Create file error:", error)
    return NextResponse.json({ error: "Failed to create file" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await req.json()
    const { oldPath, newPath } = body

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    await db
      .update(files)
      .set({ path: newPath, updatedAt: new Date() })
      .where(and(eq(files.projectId, projectId), eq(files.path, oldPath)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Rename file error:", error)
    return NextResponse.json({ error: "Failed to rename file" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(req.url)
    const path = searchParams.get("path")

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    await db.delete(files).where(and(eq(files.projectId, projectId), eq(files.path, path)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete file error:", error)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}