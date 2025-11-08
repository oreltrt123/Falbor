import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, files } from "@/config/schema"
import { eq } from "drizzle-orm"

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { projectId } = await request.json()

  // Verify project ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

  if (!project || project.userId !== userId || !project.githubUrl) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Extract owner and repo
        const match = project.githubUrl!.match(/github\.com\/([^/]+)\/([^/]+)/)
        if (!match) {
          throw new Error("Invalid GitHub URL")
        }

        const [, owner, repo] = match
        const repoName = repo.replace(/\.git$/, "")

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "Fetching repository tree..." })}\n\n`))

        // Fetch repository tree from GitHub API
        const treeResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/git/trees/main?recursive=1`,
          {
            headers: {
              Accept: "application/vnd.github.v3+json",
              ...(process.env.GITHUB_TOKEN && { Authorization: `token ${process.env.GITHUB_TOKEN}` }),
            },
          },
        )

        if (!treeResponse.ok) {
          throw new Error("Failed to fetch repository")
        }

        const treeData = await treeResponse.json()
        const fileItems = treeData.tree.filter((item: any) => item.type === "blob")

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: `Found ${fileItems.length} files` })}\n\n`))

        // Import files
        for (let i = 0; i < fileItems.length; i++) {
          const item = fileItems[i]

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: `Importing ${item.path}`, progress: Math.round(((i + 1) / fileItems.length) * 100) })}\n\n`,
            ),
          )

          // Fetch file content
          const contentResponse = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repoName}/main/${item.path}`,
          )

          if (contentResponse.ok) {
            const content = await contentResponse.text()
            const language = getLanguageFromPath(item.path)

            await db.insert(files).values({
              projectId: project.id,
              messageId: null,
              path: item.path,
              content,
              language,
            })
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
  }
  return languageMap[ext || ""] || "text"
}
