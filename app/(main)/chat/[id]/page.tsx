import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/config/db"
import { projects, messages } from "@/config/schema"
import { eq, asc } from "drizzle-orm"
import { Navbar } from "@/components/navbar/navbar"
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

  // Get project and verify ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, id))

  if (!project || project.userId !== userId) {
    redirect("/")
  }

  // Get messages
  const projectMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.projectId, id))
    .orderBy(asc(messages.createdAt))

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f1f181]">
      {/* <Navbar /> */}
      <ChatInterface project={project} initialMessages={projectMessages} />
    </div>
  )
}