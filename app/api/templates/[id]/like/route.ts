import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { templates, templateLikes } from "@/config/schema"
import { eq, and, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    // Check if already liked
    const [existingLike] = await db
      .select()
      .from(templateLikes)
      .where(and(eq(templateLikes.templateId, id), eq(templateLikes.userId, userId)))
      .limit(1)

    if (existingLike) {
      return NextResponse.json({ error: "Already liked" }, { status: 400 })
    }

    // Add like
    await db.insert(templateLikes).values({
      templateId: id,
      userId,
    })

    // Increment like count
    await db
      .update(templates)
      .set({ likes: sql`${templates.likes} + 1` })
      .where(eq(templates.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API/Templates/Like] Error:", error)
    return NextResponse.json({ error: "Failed to like template" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    // Remove like
    await db.delete(templateLikes).where(and(eq(templateLikes.templateId, id), eq(templateLikes.userId, userId)))

    // Decrement like count
    await db
      .update(templates)
      .set({ likes: sql`GREATEST(${templates.likes} - 1, 0)` })
      .where(eq(templates.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API/Templates/Like] Error:", error)
    return NextResponse.json({ error: "Failed to unlike template" }, { status: 500 })
  }
}
