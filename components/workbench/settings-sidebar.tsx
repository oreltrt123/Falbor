"use client"

import { cn } from "@/lib/utils"
import { Brain, Cpu, Settings } from "lucide-react"

interface SettingsSidebarProps {
  activeSection: "project-settings" | "ai-models" | "custom-knowledge"
  onSectionChange: (section: "project-settings" | "ai-models" | "custom-knowledge") => void
}

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const menuItemsProjectSettings = [
    {
      id: "project-settings" as const,
      label: "Project Settings",
      icon: Settings,
    },
  ]
  const menuItemsSettings = [
    {
      id: "custom-knowledge" as const,
      label: "Custom Knowledge",
      icon: Brain,
    },
    {
      id: "ai-models" as const,
      label: "AI Models",
      icon: Cpu,
    },
  ]

  return (
    <div className="w-64 border-r border-[#d6d6d6] p-4">
      <h3 className="text-sm font-semibold text-black/80 mb-4">Project Settings</h3>
      <div className="space-y-2">
        {menuItemsProjectSettings.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex w-full items-center gap-1 pl-0 px-1 pr-2 py-[3px] mb-1 hover:bg-[#e4e4e4] cursor-pointer text-[13px] relative group rounded-sm",
                activeSection === item.id ? "font-bold hover:bg-white" : "",
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </div>
      <h3 className="text-sm font-semibold text-black/80 mb-4 mt-5">AI Settings</h3>
      <div className="space-y-2">
        {menuItemsSettings.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex w-full items-center gap-1 pl-0 px-1 pr-2 py-[3px] mb-1 hover:bg-[#e4e4e4] cursor-pointer text-[13px] relative group rounded-sm",
                activeSection === item.id ? "font-bold hover:bg-white" : "",
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
