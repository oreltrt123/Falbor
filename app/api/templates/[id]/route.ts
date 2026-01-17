import { auth, clerkClient } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { templates, userCredits } from "@/config/schema"
import { eq, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

// GET single template by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    await db
      .update(templates)
      .set({ views: sql`${templates.views} + 1` })
      .where(eq(templates.id, id))

    // Get creator info
    try {
      const client = await clerkClient()
      const user = await client.users.getUser(template.creatorId)
      return NextResponse.json({
        template: {
          ...template,
          views: (template.views || 0) + 1,
          creatorName: user.firstName
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : user.username || "Anonymous",
          creatorImage: user.imageUrl,
        },
      })
    } catch {
      return NextResponse.json({
        template: {
          ...template,
          views: (template.views || 0) + 1,
          creatorName: "Anonymous",
          creatorImage: null,
        },
      })
    }
  } catch (error) {
    console.error("[API/Templates] Error fetching template:", error)
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 })
  }
}

// PUT update template
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, mainImage, images, tags, domain, cardDesign } = body

    // Verify template exists and belongs to user
    const [existingTemplate] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    if (existingTemplate.creatorId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    let finalCardDesign = "none"
    if (cardDesign && cardDesign !== "none") {
      const [credits] = await db.select().from(userCredits).where(eq(userCredits.userId, userId))
      if (credits?.subscriptionTier !== "none") {
        finalCardDesign = cardDesign
      }
    }

    // Update template
    const [updatedTemplate] = await db
      .update(templates)
      .set({
        title,
        description,
        mainImage,
        images,
        tags,
        domain,
        cardDesign: finalCardDesign,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, id))
      .returning()

    return NextResponse.json({ success: true, template: updatedTemplate })
  } catch (error) {
    console.error("[API/Templates] Error updating template:", error)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    // Verify template exists and belongs to user
    const [existingTemplate] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    if (existingTemplate.creatorId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Delete template
    await db.delete(templates).where(eq(templates.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API/Templates] Error deleting template:", error)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
