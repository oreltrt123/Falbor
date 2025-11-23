"use client"

import { useState } from "react"
import { SettingsSidebar } from "./settings-sidebar"
import { CustomKnowledgeSection } from "./custom-knowledge-section"
import { AIModelsSection } from "./ai-models-section"
import ProjectSettings  from "./ProjectSettings"

interface SettingsTabProps {
  projectId: string
}

export function SettingsTab({ projectId }: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState<"custom-knowledge" | "project-settings" | "ai-models">("project-settings")

  return (
    <div className="flex h-full">
      <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="flex-1 overflow-auto w-full">
        {activeSection === "project-settings" && <ProjectSettings projectId={projectId} />}
        {activeSection === "custom-knowledge" && <CustomKnowledgeSection />}
        {activeSection === "ai-models" && <AIModelsSection />}
      </div>
    </div>
  )
}