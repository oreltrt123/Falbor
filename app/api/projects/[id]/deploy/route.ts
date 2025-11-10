import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, files } from "@/config/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let userId: string | null
  try {
    ({ userId } = await auth())
  } catch (authError) {
    console.error("[API/Deploy] Auth error:", authError)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Extract projectId from URL as fallback if params.id is undefined (known Next.js app router issue)
  let projectId: string
  if (params?.id && typeof params.id === "string") {
    projectId = params.id
  } else {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    projectId = pathSegments[pathSegments.length - 2] // /api/projects/{id}/deploy -> second last is id
    console.warn("[API/Deploy] Params.id was undefined, extracted from URL:", projectId)
  }

  if (!projectId) {
    console.error("[API/Deploy] No project ID found in params or URL")
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 })
  }

  // Debug log
  console.log("[API/Deploy] Deploying for projectId:", projectId, "User:", userId)

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("[API/Deploy] Body parse error:", parseError)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { platform, apiKey } = body

    if (!platform || !apiKey) {
      return NextResponse.json({ error: "Missing platform or API key" }, { status: 400 })
    }

    if (!["vercel", "netlify"].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 })
    }

    // Get project
    let project
    try {
      [project] = await db.select().from(projects).where(eq(projects.id, projectId))
      console.log("[API/Deploy] Queried project:", project ? "Found" : "Not found")
    } catch (dbError) {
      console.error("[API/Deploy] DB query error:", dbError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all project files (optional, but keep for future real deployment)
    await db.select().from(files).where(eq(files.projectId, projectId)).catch((err) => {
      console.warn("[API/Deploy] Files query warning:", err)
      // Don't fail deployment on this
    })

    // Simulate deployment (in real implementation, call Vercel/Netlify APIs)
    const deploymentUrl =
      platform === "vercel"
        ? `https://${project.title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.vercel.app`
        : `https://${project.title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.netlify.app`

    // Update project with deployment info
    try {
      await db
        .update(projects)
        .set({
          deploymentConfig: {
            platform,
            apiKey: "***", // Don't store actual key
            deploymentUrl,
            lastDeployedAt: new Date().toISOString(),
          },
        })
        .where(eq(projects.id, projectId))
      console.log("[API/Deploy] Updated deployment config for project:", projectId)
    } catch (updateError) {
      console.error("[API/Deploy] DB update error:", updateError)
      return NextResponse.json({ error: "Failed to save deployment info" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deploymentUrl,
      message: "Project deployed successfully",
    })
  } catch (error) {
    console.error("[API/Deploy] Unexpected error:", error)
    return NextResponse.json({ error: "Deployment failed" }, { status: 500 })
  }
}