import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, projectSupabase } from "@/config/schema"
import { eq } from "drizzle-orm"
import { createClient } from "@supabase/supabase-js"

interface UserInfo {
  id: string
  email?: string | null
  createdAt: string | null
  lastSignIn: string | null
  confirmed: boolean
  banned: boolean
}

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

    if (!supabaseConfig?.serviceRoleKey) {
      return Response.json(
        {
          success: true,
          users: [] as UserInfo[],
          message: "Supabase not fully provisioned or missing service role",
        },
        { status: 200 }
      )
    }

    const supabaseAdmin = createClient(supabaseConfig.supabaseUrl, supabaseConfig.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) throw error

    const users: UserInfo[] = data.users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignIn: user.last_sign_in_at ?? null,
      confirmed: !!user.confirmed_at,
      banned: !!(user as any).banned_until,
    }))

    return Response.json(
      {
        success: true,
        users,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("[Supabase Users] Error:", error)
    return Response.json(
      { success: false, error: error.message || "Failed to fetch users" },
      { status: 500 }
    )
  }
}
