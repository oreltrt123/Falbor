// components/workbench/sidebar-tabs.tsx
import { cn } from "@/lib/utils"
import { Files, Search, Lock } from "lucide-react"

interface SidebarTabsProps {
  sidebarView: "files" | "search" | "locks"
  setSidebarView: (view: "files" | "search" | "locks") => void
}

export function SidebarTabs({ sidebarView, setSidebarView }: SidebarTabsProps) {
  return (
    <div className="flex items-end pb-[5px] pt-1 pl-1 border-[#4444442d] border-b">
      <button
        onClick={() => setSidebarView("files")}
        className={cn(
          "w-[80px] h-[24px] mr-0.5 flex items-center rounded-sm justify-center gap-1.5 py-1.5 text-[13px] font-medium transition-colors -mb-[1px]",
          sidebarView === "files"
            ? "text-black hover:text-black hover:bg-[#7a7a7a38] bg-[#7a7a7a2a]"
            : "text-black/50 hover:text-black hover:bg-[#7a7a7a1f]"
        )}
      >
        <Files className="w-3.5 h-3.5" />
        Files
      </button>

      <button
        onClick={() => setSidebarView("search")}
        className={cn(
          "w-[80px] h-[24px] mr-0.5 flex items-center rounded-sm justify-center gap-1.5 py-1.5 text-[13px] font-medium transition-colors -mb-[1px]",
          sidebarView === "search"
            ? "text-black hover:text-black hover:bg-[#7a7a7a38] bg-[#7a7a7a2a]"
            : "text-black/50 hover:text-black hover:bg-[#7a7a7a1f]"
        )}
      >
        <Search className="w-3.5 h-3.5" />
        Search
      </button>

      <button
        onClick={() => setSidebarView("locks")}
        className={cn(
          "w-[80px] h-[24px] flex items-center rounded-sm justify-center gap-1.5 py-1.5 text-[13px] font-medium transition-colors -mb-[1px]",
          sidebarView === "locks"
            ? "text-black hover:text-black hover:bg-[#7a7a7a38] bg-[#7a7a7a2a]"
            : "text-black/50 hover:text-black hover:bg-[#7a7a7a1f]"
        )}
      >
        <Lock className="w-3.5 h-3.5" />
        Locks
      </button>
    </div>
  )
}