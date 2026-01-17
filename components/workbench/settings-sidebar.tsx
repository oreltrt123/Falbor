"use client"

import { cn } from "@/lib/utils"
import { Brain, Cpu, Settings, Shield, CheckSquare, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SettingsSidebarProps {
  activeSection: "project-settings" | "ai-models" | "custom-knowledge" | "security" | "tasks" | "publish-template"
  onSectionChange: (
    section: "project-settings" | "ai-models" | "custom-knowledge" | "security" | "tasks" | "publish-template",
  ) => void
}

const menuItems = [
  {
    id: "project-settings" as const,
    label: "General",
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
    id: "publish-template" as const,
    label: "Publish to Template",
    icon: Upload,
    group: "Project Settings",
  },
  {
    id: "custom-knowledge" as const,
    label: "Custom Knowledge",
    icon: Brain,
    group: "Project Settings",
  },
  // {
  //   id: "ai-models" as const,
  //   label: "AI Models",
  //   icon: Cpu,
  //   group: "AI Settings",
  // },
]

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const groups = Array.from(new Set(menuItems.map((item) => item.group)))

  return (
    <div className="w-72 border-r border-[#d6d6d6] p-1">
      {groups.map((group) => (
        <div key={group} className="mb-5 last:mb-0">
          <h3 className="text-sm font-semibold text-black/80 mb-4 mt-2 ml-2">{group}</h3>
          <div className="space-y-2 mt-[-8px]">
            {menuItems
              .filter((item) => item.group === group)
              .map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={cn(
                      "flex w-full items-center gap-1 pl-0 px-2 pr-2 py-2 mb-1 group rounded-sm hover:bg-[#e4e4e4a8] cursor-pointer text-[13px] relative group",
                      activeSection === item.id ? "bg-[#e4e4e4a8]" : "",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {item.id === "tasks" && (
                      <Badge className="ml-2 absolute right-1" variant="secondary">
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
