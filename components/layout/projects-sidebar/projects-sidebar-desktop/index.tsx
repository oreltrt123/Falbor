// src/components/layout/projects-sidebar-desktop.tsx
import { ScrollArea } from "@/components/ui/scroll-area"
import { ProjectsList } from "@/components/project/projects-list"
import { auth } from "@clerk/nextjs/server"

export async function ProjectsSidebarDesktop() {
  const { userId } = await auth()

  if (!userId) return null

  return (
    <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-80 bg-[#161616] border-r border-[#2a2a2a] flex-col z-40">
      <div className="p-6 border-b border-[#2a2a2a]">
        <h2 className="text-xl font-semibold text-white">Your Projects</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-6">
          <ProjectsList userId={userId} />
        </div>
      </ScrollArea>
    </aside>
  )
}