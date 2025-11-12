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
    <div className="bg-[#1f1e1e] border-3 border-[#272727] border-t-0 rounded-b-[13px] p-4 max-h-[400px] overflow-y-auto">
      <div className="flex gap-1 mb-4 overflow-x-hidden chat-messages-scroll">
        {categories.map((cat) => (
          <Button
            key={cat.name}
            variant={selectedCategory === cat.name ? "default" : "ghost"}
            onClick={() => setSelectedCategory(cat.name)}
            className={`h-6 px-1.5 text-xs bg-[#2f2f30] text-white hover:text-white border-[#272727] hover:bg-[#313135] ${
                selectedCategory === cat.name ? "bg-[#ff8c001f] hover:bg-[#ff8c0025]" : ""
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
            p-2 h-auto bg-[#30303052] border-none
            hover:bg-[#30303067] transition-colors text-white/70
            hover:text-white text-xs"
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