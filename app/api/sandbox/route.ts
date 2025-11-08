import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, files } from "@/config/schema"
import { eq } from "drizzle-orm"
import { Sandbox } from "@e2b/code-interpreter"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.E2B_API_KEY) {
      console.error("[v0] E2B_API_KEY is not set")
      return NextResponse.json(
        { error: "E2B_API_KEY environment variable is not configured. Please add it in the Vars section." },
        { status: 500 },
      )
    }

    const { projectId } = await req.json()

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 403 })
    }

    console.log("[v0] Creating E2B sandbox for project:", projectId)

    const sandbox = await Sandbox.create({
      timeoutMs: 10 * 60 * 1000,
    })

    const sandboxId = sandbox.sandboxId
    console.log("[v0] Created sandbox:", sandboxId)

    // Get project files
    const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId))

    console.log("[v0] Writing files to sandbox:", projectFiles.length)

    for (const file of projectFiles) {
      try {
        await sandbox.files.write(file.path, file.content)
        console.log(`[v0] Wrote file: ${file.path}`)
      } catch (err) {
        console.error(`[v0] Failed to write file ${file.path}:`, err)
      }
    }

    // Install dependencies if package.json exists
    const startCommand = "npm run dev"
    const packageJsonFile = projectFiles.find((f) => f.path === "package.json")

    if (packageJsonFile) {
      try {
        console.log("[v0] Installing dependencies...")
        const installResult = await sandbox.commands.run("npm install", { timeout: 120 })
        console.log("[v0] Install result:", installResult.exitCode)
        if (installResult.stderr) console.log("[v0] Install stderr:", installResult.stderr)
      } catch (err) {
        console.error("[v0] Failed to install dependencies:", err)
      }

      try {
        console.log("[v0] Starting dev server with:", startCommand)
        sandbox.commands.run(startCommand, { timeout: 30 }).catch((e) => console.log("[v0] Server start error:", e))
      } catch (err) {
        console.error("[v0] Failed to start dev server:", err)
      }
    }

    const previewUrl = `https://${sandbox.getHost(3000)}`

    console.log("[v0] Preview URL:", previewUrl)

    // Update project with sandbox ID and preview URL
    await db.update(projects).set({ sandboxId }).where(eq(projects.id, projectId))

    return NextResponse.json({ sandboxId, previewUrl })
  } catch (error) {
    console.error("[v0] Sandbox creation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sandbox" },
      { status: 500 },
    )
  }
}
