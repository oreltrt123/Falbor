import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/config/db"
import { projects, messages, files } from "@/config/schema"
import { eq } from "drizzle-orm"

interface GitHubFile {
  path: string
  type: "blob" | "tree"
  sha: string
  size: number
  url: string
  download_url?: string
}

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { owner, repo, githubUrl } = await request.json()

    console.log("[v0] GitHub clone request:", { owner, repo, githubUrl })

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner or repo" }, { status: 400 })
    }

    // Create project
    const [project] = await db
      .insert(projects)
      .values({
        userId,
        title: `${owner}/${repo}`,
        isGithubClone: true,
        githubUrl: githubUrl || `https://github.com/${owner}/${repo}`,
      })
      .returning()

    console.log("[v0] Created project:", project.id)

    // Fetch repository tree from GitHub API
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`
    const treeResponse = await fetch(treeUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
    })

    console.log("[v0] GitHub API response status:", treeResponse.status)

    let treeData: any
    if (!treeResponse.ok) {
      const errorText = await treeResponse.text()
      console.error(`[v0] GitHub error (main): ${treeResponse.status} - ${errorText}`)

      // Try 'master' branch if 'main' fails
      const masterTreeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`
      const masterResponse = await fetch(masterTreeUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      })

      if (!masterResponse.ok) {
        const masterErrorText = await masterResponse.text()
        console.error(`[v0] GitHub error (master): ${masterResponse.status} - ${masterErrorText}`)
        throw new Error("Failed to fetch repository tree from both main and master branches")
      }

      const masterData = await masterResponse.json()
      treeData = masterData
      console.log("[v0] Fetched tree from master, files count:", masterData.tree?.length || 0)
      await processRepositoryFiles(masterData.tree, owner, repo, project.id, "master")
    } else {
      treeData = await treeResponse.json()
      console.log("[v0] Fetched tree from main, files count:", treeData.tree?.length || 0)
      await processRepositoryFiles(treeData.tree, owner, repo, project.id, "main")
    }

    // Create initial system message
    const fileCount = await db
      .select()
      .from(files)
      .where(eq(files.projectId, project.id))
      .then((results) => results.length)

    console.log("[v0] Total files saved:", fileCount)

    await db.insert(messages).values({
      projectId: project.id,
      role: "assistant",
      content: `Successfully cloned **${owner}/${repo}** repository!\n\nFetched **${fileCount} files** from GitHub. You can now explore the codebase and ask me questions about it.\n\nWhat would you like to know about this project?`,
      hasArtifact: true,
    })

    return NextResponse.json({ projectId: project.id })
  } catch (error) {
    console.error("[GitHub Clone] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clone repository" },
      { status: 500 },
    )
  }
}

async function processRepositoryFiles(
  tree: GitHubFile[],
  owner: string,
  repo: string,
  projectId: string,
  branch = "main",
) {
  // Filter only files (blobs, not trees) and limit to reasonable size
  const fileItems = tree.filter(
    (item) => item.type === "blob" && item.size < 1000000, // 1MB limit per file
  )

  console.log("[v0] Processing files, filtered count:", fileItems.length)

  // Limit total files to prevent overwhelming the system
  const limitedFiles = fileItems.slice(0, 100)

  // Fetch file contents in batches
  const batchSize = 10
  for (let i = 0; i < limitedFiles.length; i += batchSize) {
    const batch = limitedFiles.slice(i, i + batchSize)
    console.log(`[v0] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(limitedFiles.length / batchSize)}`)
    await Promise.all(
      batch.map(async (file) => {
        try {
          const contentUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`
          const contentResponse = await fetch(contentUrl, {
            headers: {
              ...(process.env.GITHUB_TOKEN && {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              }),
            },
          })

          if (!contentResponse.ok) {
            console.error(`[v0] Failed to fetch ${file.path}: ${contentResponse.status}`)
            return
          }

          // Skip binary/non-text files (e.g., images, zips) to avoid text() errors
          const contentType = contentResponse.headers.get('content-type') || ''
          if (!contentType.startsWith('text/') && !contentType.includes('javascript') && !contentType.includes('json')) {
            console.log(`[v0] Skipped binary/non-text file: ${file.path}`)
            return
          }

          const content = await contentResponse.text()
          await saveFile(file.path, content, projectId)
          console.log("[v0] Saved file:", file.path)
        } catch (err) {
          console.error(`[v0] Failed to fetch ${file.path}:`, err)
        }
      }),
    )
  }
}

async function saveFile(path: string, content: string, projectId: string) {
  const language = getLanguageFromPath(path)

  await db.insert(files).values({
    projectId,
    path,
    content,
    language,
    additions: content.split("\n").length,
    deletions: 0,
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
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    go: "go",
    rs: "rust",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sh: "bash",
    sql: "sql",
  }

  return languageMap[ext || ""] || "plaintext"
}