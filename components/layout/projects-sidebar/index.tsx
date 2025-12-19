// src/components/layout/cyber-sidebar.tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ProjectsList } from "@/components/project/projects-list"
import { auth } from "@clerk/nextjs/server"
import { PanelLeft } from "lucide-react"

export async function CyberSidebar() {
  const { userId } = await auth()

  // If no user, don't render anything
  if (!userId) return null

  return (
    <SidebarProvider className="fixed z-20">
      {/* Invisible trigger zone on the far left edge */}
      <div className="p-4 fixed inset-y-0 left-0 z-50 w-4 md:w-6 bg-transparent pointer-events-auto">
        <SidebarTrigger className="" />
      </div>

      <Sidebar className="bg-white shadow-2xl shadow-cyan-600/30">
        <SidebarHeader>
          <div className="flex items-center justify-between p-6">
            <h2 className="font-bold px-4 mt-[-11px]">
              <img src="/logo_light.png" className="absolute top-[-12px] " width={130} alt="" />
            </h2>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="p-4">
            <ProjectsList userId={userId} />
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t bg-gradient-to-t from-cyan-900/20 to-transparent">
          <div className="p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-cyan-600 [text-shadow:0_0_10px_rgba(34,211,238,0.5)]">
             
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}