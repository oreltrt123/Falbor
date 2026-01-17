import { auth, clerkClient } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { templates, projects, userCredits } from "@/config/schema"
import { eq, desc } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId, title, description, mainImage, images, tags, domain, cardDesign } = body

    // Validate required fields
    if (!projectId || !title || !description || !mainImage || !domain) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate images
    if (!images || images.length < 4) {
      return NextResponse.json({ error: "At least 4 additional images are required" }, { status: 400 })
    }

    // Validate tags
    if (!tags || tags.length === 0 || tags.length > 5) {
      return NextResponse.json({ error: "1 to 5 tags are required" }, { status: 400 })
    }

    // Verify project belongs to user
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 403 })
    }

    // Check subscription for card design
    let finalCardDesign = "none"
    if (cardDesign && cardDesign !== "none") {
      const [credits] = await db.select().from(userCredits).where(eq(userCredits.userId, userId))
      if (credits?.subscriptionTier !== "none") {
        finalCardDesign = cardDesign
      }
    }

    // Create template
    const [newTemplate] = await db
      .insert(templates)
      .values({
        projectId,
        title,
        description,
        mainImage,
        images,
        tags,
        domain,
        creatorId: userId,
        cardDesign: finalCardDesign,
      })
      .returning()

    return NextResponse.json({ success: true, template: newTemplate })
  } catch (error) {
    console.error("[API/Templates] Error creating template:", error)
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const allTemplates = await db.select().from(templates).orderBy(desc(templates.createdAt))

    // Get creator info and subscription status for each template
    const templatesWithCreator = await Promise.all(
      allTemplates.map(async (template) => {
        try {
          const client = await clerkClient()
          const user = await client.users.getUser(template.creatorId)

          // Check if creator has subscription
          const [credits] = await db.select().from(userCredits).where(eq(userCredits.userId, template.creatorId))
          const hasSubscription = credits?.subscriptionTier !== "none"

          return {
            ...template,
            creatorName: user.firstName
              ? `${user.firstName} ${user.lastName || ""}`.trim()
              : user.username || "Anonymous",
            creatorImage: user.imageUrl,
            hasSubscription,
          }
        } catch {
          return {
            ...template,
            creatorName: "Anonymous",
            creatorImage: null,
            hasSubscription: false,
          }
        }
      }),
    )

    return NextResponse.json({ templates: templatesWithCreator })
  } catch (error) {
    console.error("[API/Templates] Error fetching templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}
