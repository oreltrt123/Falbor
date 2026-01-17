"use client"

import { useState } from "react"
import { SettingsSidebar } from "./settings-sidebar"
import { CustomKnowledgeSection } from "./custom-knowledge-section"
import { AIModelsSection } from "./ai-models-section"
import ProjectSettings from "./ProjectSettings"
import { SecuritySection } from "./security-section"
import { TasksSection } from "./tasks"
import { PublishTemplateSection } from "./templates/publish-template-section"

interface SettingsTabProps {
  projectId: string
}

export function SettingsTab({ projectId }: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState<
    "custom-knowledge" | "project-settings" | "ai-models" | "security" | "tasks" | "publish-template"
  >("project-settings")

  return (
    <div className="flex w-full">
      <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="flex-1 overflow-auto w-full p-6">
        {activeSection === "project-settings" && <ProjectSettings projectId={projectId} />}
        {activeSection === "custom-knowledge" && <CustomKnowledgeSection />}
        {activeSection === "ai-models" && <AIModelsSection />}
        {activeSection === "security" && <SecuritySection projectId={projectId} />}
        {activeSection === "tasks" && <TasksSection projectId={projectId} />}
        {activeSection === "publish-template" && <PublishTemplateSection projectId={projectId} />}
      </div>
    </div>
  )
}
