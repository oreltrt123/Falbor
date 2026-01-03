"use client"

import { cn } from "@/lib/utils"
import { Brain, Cpu, Settings, Shield, CheckSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SettingsSidebarProps {
  activeSection: "project-settings" | "ai-models" | "custom-knowledge" | "security" | "tasks"
  onSectionChange: (section: "project-settings" | "ai-models" | "custom-knowledge" | "security" | "tasks") => void
}

const menuItems = [
  {
    id: "project-settings" as const,
    label: "Project Settings",
    icon: Settings,
    group: "Project Settings",
  },
  {
    id: "security" as const,
    label: "Security",
    icon: Shield,
    group: "Project Settings",
  },
  {
    id: "tasks" as const,
    label: "Tasks",
    icon: CheckSquare,
    group: "Project Settings",
  },
  {
    id: "custom-knowledge" as const,
    label: "Custom Knowledge",
    icon: Brain,
    group: "AI Settings",
  },
  {
    id: "ai-models" as const,
    label: "AI Models",
    icon: Cpu,
    group: "AI Settings",
  },
]

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const groups = Array.from(new Set(menuItems.map((item) => item.group)))

  return (
    <div className="w-64 border-r border-[#d6d6d6] p-4">
      {groups.map((group) => (
        <div key={group} className="mb-5 last:mb-0">
          <h3 className="text-sm font-semibold text-black/80 mb-4">{group}</h3>
          <div className="space-y-2">
            {menuItems
              .filter((item) => item.group === group)
              .map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={cn(
                      "flex w-full items-center gap-1 pl-0 px-2 pr-2 py-1 mb-1 hover:bg-[#c1603c1a] cursor-pointer text-[13px] relative group rounded-sm",
                      activeSection === item.id ? "bg-[#c1603c1a]" : "",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {item.id === "security" && (
                      <Badge className="ml-2 absolute right-25" variant="secondary">
                        Beta
                      </Badge>
                    )}
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
