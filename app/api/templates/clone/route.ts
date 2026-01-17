import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { templates, projects, files, messages } from "@/config/schema"
import { eq, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { templateId } = body

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    // Get the template
    const [template] = await db.select().from(templates).where(eq(templates.id, templateId))

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Get the original project's files
    const originalFiles = await db.select().from(files).where(eq(files.projectId, template.projectId))

    // Create a new project for the user
    const [newProject] = await db
      .insert(projects)
      .values({
        userId,
        title: `Clone of ${template.title}`,
        description: template.description,
        selectedModel: "gemini",
      })
      .returning()

    // Create an initial system message indicating this is a cloned project
    const [initialMessage] = await db
      .insert(messages)
      .values({
        projectId: newProject.id,
        role: "assistant",
        content: `This project was cloned from the template "${template.title}". All files from the original template have been imported. You can start modifying the project or ask me to help you customize it!`,
        hasArtifact: originalFiles.length > 0,
      })
      .returning()

    // Copy all files to the new project
    if (originalFiles.length > 0) {
      // Get unique files (latest version of each path)
      const uniqueFiles = new Map<string, (typeof originalFiles)[0]>()
      for (const file of originalFiles) {
        const existing = uniqueFiles.get(file.path)
        if (!existing || new Date(file.createdAt) > new Date(existing.createdAt)) {
          uniqueFiles.set(file.path, file)
        }
      }

      const filesToInsert = Array.from(uniqueFiles.values()).map((file) => ({
        projectId: newProject.id,
        messageId: initialMessage.id,
        path: file.path,
        content: file.content,
        language: file.language,
        type: file.type,
        parentPath: file.parentPath,
        additions: 0,
        deletions: 0,
      }))

      await db.insert(files).values(filesToInsert)
    }

    await db
      .update(templates)
      .set({ clones: sql`${templates.clones} + 1` })
      .where(eq(templates.id, templateId))

    return NextResponse.json({
      success: true,
      projectId: newProject.id,
      message: `Successfully cloned template with ${originalFiles.length} files`,
    })
  } catch (error) {
    console.error("[API/Templates/Clone] Error cloning template:", error)
    return NextResponse.json({ error: "Failed to clone template" }, { status: 500 })
  }
}
