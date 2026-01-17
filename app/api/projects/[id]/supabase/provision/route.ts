// name provision

import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, projectSupabase, projectLogs } from "@/config/schema"
import { eq } from "drizzle-orm"
import { createSupabaseProject } from "@/lib/supabase/management-api"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId } = await auth()

  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project || project.userId !== userId) {
      return Response.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    const [supabaseConfig] = await db
      .select()
      .from(projectSupabase)
      .where(eq(projectSupabase.projectId, projectId))

    if (!supabaseConfig) {
      return Response.json(
        {
          success: true,
          credentials: null,
          message: "Supabase not provisioned for this project",
        },
        { status: 200 }
      )
    }

    return Response.json(
      {
        success: true,
        credentials: {
          supabaseUrl: supabaseConfig.supabaseUrl,
          anonKey: supabaseConfig.anonKey,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Supabase GET Config] Error:", error)
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId } = await auth()

  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project || project.userId !== userId) {
      return Response.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    // Check if already provisioned
    const [existing] = await db
      .select({
        supabaseUrl: projectSupabase.supabaseUrl,
        anonKey: projectSupabase.anonKey,
      })
      .from(projectSupabase)
      .where(eq(projectSupabase.projectId, projectId))

    if (existing) {
      return Response.json(
        {
          success: true,
          alreadyExists: true,
          message: "Supabase already provisioned",
          credentials: {
            supabaseUrl: existing.supabaseUrl,
            anonKey: existing.anonKey,
          },
        },
        { status: 200 }
      )
    }

    const orgSlug = process.env.SUPABASE_ORG_SLUG
    if (!orgSlug) {
      throw new Error("SUPABASE_ORG_SLUG environment variable is not set")
    }

    const credentials = await createSupabaseProject({
      name: `ai-site-${projectId.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
      organizationSlug: orgSlug,
      region: "aws-us-east-1",
    })

    await db.insert(projectSupabase).values({
      projectId,
      supabaseProjectRef: credentials.projectRef,
      supabaseUrl: credentials.supabaseUrl,
      anonKey: credentials.anonKey,
      serviceRoleKey: credentials.serviceRoleKey,
      dbPassword: credentials.dbPassword,
      region: credentials.region,
    })

    await db.insert(projectLogs).values({
      projectId,
      level: "success",
      message: "Supabase project provisioned successfully",
      details: { projectRef: credentials.projectRef, region: credentials.region },
    })

    return Response.json(
      {
        success: true,
        credentials: {
          supabaseUrl: credentials.supabaseUrl,
          anonKey: credentials.anonKey,
        },
        envFile: `VITE_SUPABASE_URL=${credentials.supabaseUrl}\nVITE_SUPABASE_ANON_KEY=${credentials.anonKey}`,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[Supabase Provision] Error:", error)

    await db.insert(projectLogs).values({
      projectId,
      level: "error",
      message: "Failed to provision Supabase project",
      details: { errorMessage: error.message || String(error) },
    })

    return Response.json(
      { success: false, error: error.message || "Failed to provision Supabase" },
      { status: 500 }
    )
  }
}