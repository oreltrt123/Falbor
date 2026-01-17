import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { templates } from "@/config/schema"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { projectId } = await params

    const [template] = await db.select().from(templates).where(eq(templates.projectId, projectId)).limit(1)

    return NextResponse.json({ template: template || null })
  } catch (error) {
    console.error("[API/Templates] Error fetching template:", error)
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 })
  }
}
