import { db } from "@/config/db"
import { templates, projects, templateLikes } from "@/config/schema"
import { eq, and, sql } from "drizzle-orm"
import { clerkClient, auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"
import { TemplateDetail } from "@/components/workbench/templates/template-detail"
import { type CardDesignType } from "@/components/workbench/templates/card-designs"

interface TemplatePageProps {
  params: Promise<{ id: string }>
}

async function getTemplate(id: string, currentUserId: string | null) {
  const [template] = await db.select().from(templates).where(eq(templates.id, id))

  if (!template) return null

  // Increment view count
  await db
    .update(templates)
    .set({ views: sql`${templates.views} + 1` })
    .where(eq(templates.id, id))

  // Get creator info
  let creatorName = "Anonymous"
  let creatorImage: string | null = null

  try {
    const client = await clerkClient()
    const user = await client.users.getUser(template.creatorId)
    creatorName = user.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : user.username || "Anonymous"
    creatorImage = user.imageUrl
  } catch {
    // Keep defaults
  }

  // Get project info
  const [project] = await db.select().from(projects).where(eq(projects.id, template.projectId))

  // Check if current user liked this template
  let isLiked = false
  if (currentUserId) {
    const [like] = await db
      .select()
      .from(templateLikes)
      .where(and(eq(templateLikes.templateId, id), eq(templateLikes.userId, currentUserId)))
      .limit(1)
    isLiked = !!like
  }

  // Validate cardDesign type
  const allowedCardDesigns: CardDesignType[] = ["none"]
  const cardDesign: CardDesignType =
    template.cardDesign && allowedCardDesigns.includes(template.cardDesign as CardDesignType)
      ? (template.cardDesign as CardDesignType)
      : "none"

  return {
    ...template,
    views: (template.views || 0) + 1,
    creatorName,
    creatorImage,
    projectTitle: project?.title || template.title,
    isLiked,
    cardDesign,
    clones: template.clones || 0,
    likes: template.likes || 0,
    isFeatured: template.isFeatured || false,
  }
}

export async function generateMetadata({ params }: TemplatePageProps) {
  const resolvedParams = await params
  const template = await getTemplate(resolvedParams.id, null)

  if (!template) {
    return {
      title: "Template Not Found",
    }
  }

  return {
    title: `${template.title} | Templates`,
    description: template.description,
  }
}

export default async function TemplatePage({ params }: TemplatePageProps) {
  const resolvedParams = await params
  const { userId } = await auth()
  const template = await getTemplate(resolvedParams.id, userId)

  if (!template) notFound()

  return <TemplateDetail template={template} />
}
