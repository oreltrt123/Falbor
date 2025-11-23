// components/ideas-panel.tsx
"use client"

import { useState } from "react"
import { categories } from "@/types/ideas"
import { Button } from "@/components/ui/button"

interface IdeasPanelProps {
  onSelectIdea: (prompt: string) => void
}

export function IdeasPanel({ onSelectIdea }: IdeasPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || "")

  const currentCategory = categories.find((cat) => cat.name === selectedCategory)

  return (
    <div className="bg-[#ffffff] border-1 border-[#dbd9d9] border-t-0 rounded-b-[13px] p-4 max-h-[400px] overflow-y-auto">
      <div className="flex gap-1 mb-4 overflow-x-hidden chat-messages-scroll">
        {categories.map((cat) => (
          <Button
            key={cat.name}
            variant={selectedCategory === cat.name ? "default" : "ghost"}
            onClick={() => setSelectedCategory(cat.name)}
            className={`h-6 px-1.5 text-xs bg-[#e4e4e494] hover:bg-[#e7e7e7] text-black border-[#272727] ${
                selectedCategory === cat.name ? "bg-[#e4e4e4] hover:bg-[#e4e4e4]" : ""
            }`}
          >
            {cat.name}
          </Button>
        ))}
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto chat-messages-scroll">
        {currentCategory?.ideas.map((idea, index) => (
          <Button
            key={index}
            variant="ghost"
            onClick={() => onSelectIdea(idea.prompt)}
            className="w-full justify-start text-left 
            p-2 h-auto bg-[#e4e4e494] hover:bg-[#e7e7e7] text-black border-none
            transition-colors text-xs"
          >
            {idea.title}
          </Button>
        )) || (
          <p className="text-muted-foreground text-sm">Select a category to view ideas.</p>
        )}
      </div>
    </div>
  )
}