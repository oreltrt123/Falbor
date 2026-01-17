import { db } from "@/config/db"
import { templates, userCredits } from "@/config/schema"
import { desc, eq } from "drizzle-orm"
import { clerkClient } from "@clerk/nextjs/server"
import { TemplatesGrid } from "@/components/workbench/templates/templates-grid"

export const metadata = {
  title: "Templates | Falbor",
  description: "Browse and clone templates created by the community",
}

async function getTemplates() {
  const allTemplates = await db.select().from(templates).orderBy(desc(templates.createdAt))

  const templatesWithCreator = await Promise.all(
    allTemplates.map(async (template) => {
      try {
        const client = await clerkClient()
        const user = await client.users.getUser(template.creatorId)

        // Check if creator has subscription for boost
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

  return templatesWithCreator
}

export default async function TemplatesPage() {
  const templatesData = await getTemplates()

  return (
    <div className="min-h-screen bg-background">
      {/* <div className="w-full h-[350px]">
        <img src="/bg/templates.png" alt="Templates Banner" className="w-full h-full object-cover" />
      </div> */}
      <div className="container mx-auto px-4 mt-10 py-8 w-full">
        <div className="">
           <h2 className="font-medium text-muted-foreground tracking-tight relative text-4xl font-sans text-center">
            Start with the best{" "} <span className="font-semibold text-primary">Templates.</span>
          </h2>
          <p className="text-muted-foreground text-[13px] text-center">
            Discover templates published by the community to give you the easy way out
          </p>
        </div>
        <div className="container mx-auto px-34 py-8 w-full">
          <TemplatesGrid templates={templatesData} />
        </div>
      </div>
    </div>
  )
}
