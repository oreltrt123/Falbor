import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/config/db"
import { projects, messages, projectCollaborators } from "@/config/schema"
import { eq, asc, and } from "drizzle-orm"
import { ChatInterface } from "@/components/chat-interface"

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  const { id } = await params

  if (!userId) {
    redirect("/sign-in")
  }

  // 1. Get project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))

  if (!project) {
    redirect("/")
  }

  // 2. Check if user is OWNER
  const isOwner = project.userId === userId

  // 3. Check if user is COLLABORATOR
  const collaborator = await db
    .select()
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, id),
        eq(projectCollaborators.userId, userId),
        eq(projectCollaborators.status, "accepted")
      )
    )
    .limit(1)

  const isCollaborator = collaborator.length > 0

  // 4. Block if neither
  if (!isOwner && !isCollaborator) {
    redirect("/")
  }

  // 5. Get messages
  const projectMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.projectId, id))
    .orderBy(asc(messages.createdAt))

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAF9F5" }}>
      <ChatInterface project={project} initialMessages={projectMessages} />
    </div>
  )
}