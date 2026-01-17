// name tables

import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects, projectSupabase } from "@/config/schema"
import { eq } from "drizzle-orm"
import { getProjectTables, getTableColumns } from "@/lib/supabase/management-api"

interface Column {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

interface Table {
  name: string
  schema: string
  columns: Column[]
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

    if (!supabaseConfig) {
      return Response.json(
        {
          success: true,
          tables: [] as Table[],
          message: "Supabase not provisioned",
        },
        { status: 200 }
      )
    }

    const rawTables = await getProjectTables(supabaseConfig.supabaseProjectRef)

    const tables: Table[] = await Promise.all(
      rawTables.map(async (table: any) => {
        try {
          const columnsRaw = await getTableColumns(
            supabaseConfig.supabaseProjectRef,
            table.table_name
          )

          return {
            name: table.table_name,
            schema: table.table_schema,
            columns: columnsRaw.map((col: any) => ({
              name: col.column_name,
              type: col.data_type,
              nullable: col.is_nullable === "YES",
              default: col.column_default,
            })),
          }
        } catch (err) {
          console.warn(`Failed to load columns for table ${table.table_name}:`, err)
          return {
            name: table.table_name,
            schema: table.table_schema,
            columns: [] as Column[],
          }
        }
      })
    )

    return Response.json(
      {
        success: true,
        tables,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("[Supabase Tables] Error:", error)
    return Response.json(
      { success: false, error: "Failed to fetch database schema" },
      { status: 500 }
    )
  }
}