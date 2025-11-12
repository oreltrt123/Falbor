// components/workbench/input-area.tsx
"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Lightbulb } from "lucide-react"
import { ChatInput } from "./chat-input"
import { GithubClone } from "@/components/github-clone"
import { IdeasPanel } from "@/components/ideas-panel"

interface InputAreaProps {
  isAuthenticated: boolean
}

export function InputArea({ isAuthenticated }: InputAreaProps) {
  const [showIdeas, setShowIdeas] = useState(false)
  const chatInputRef = useRef<any>(null)

  const handleSelectIdea = (prompt: string) => {
    chatInputRef.current?.insertPrompt(prompt)
  }

  return (
    <div className="">
      <ChatInput
        ref={chatInputRef}
        isAuthenticated={isAuthenticated}
        connected={showIdeas}
        onCloseIdeas={() => setShowIdeas(false)}
      />
      {showIdeas && (
        <IdeasPanel
          onSelectIdea={handleSelectIdea}
        />
      )}
      {!showIdeas && isAuthenticated && (
        <div className="flex justify-center items-center gap-3 mt-3">
          <GithubClone />
          <button
            onClick={() => setShowIdeas(true)}
            className="text-sm font-medium cursor-pointer py-1 p-2 border border-[#44444450] hover:border-[#ff8c001f] rounded-4xl bg-[#272727a6] text-[#e9e9e9] flex items-center gap-2"
          >
            <Lightbulb size={16} className="h-4 w-4" />
            Suggestions
          </button>
        </div>
      )}
    </div>
  )
}