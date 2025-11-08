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
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json({ results: [] })
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const projectFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), eq(files.type, "file")))

    const results: Array<{
      path: string
      line: number
      content: string
      matches: { start: number; end: number }[]
    }> = []

    const lowerQuery = query.toLowerCase()

    for (const file of projectFiles) {
      // Search in filename
      if (file.path.toLowerCase().includes(lowerQuery)) {
        results.push({
          path: file.path,
          line: 0,
          content: file.path,
          matches: [
            {
              start: file.path.toLowerCase().indexOf(lowerQuery),
              end: file.path.toLowerCase().indexOf(lowerQuery) + query.length,
            },
          ],
        })
      }

      // Search in file content
      const lines = file.content.split("\n")
      lines.forEach((line, idx) => {
        const lowerLine = line.toLowerCase()
        if (lowerLine.includes(lowerQuery)) {
          const start = lowerLine.indexOf(lowerQuery)
          results.push({
            path: file.path,
            line: idx + 1,
            content: line.trim(),
            matches: [
              {
                start,
                end: start + query.length,
              },
            ],
          })
        }
      })
    }

    return NextResponse.json({ results: results.slice(0, 50) })
  } catch (error) {
    console.error("[v0] Search error:", error)
    return NextResponse.json({ error: "Failed to search" }, { status: 500 })
  }
}
