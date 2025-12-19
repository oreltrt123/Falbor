// components/workbench/input-area.tsx (Updated: Added FigmaImport button)
"use client"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Lightbulb } from "lucide-react"
import { ChatInput, type ChatInputRef } from "@/components/layout/chat"    // Import ChatInputRef for typing
import { GithubClone } from "@/components/models/github-clone"
import { FigmaImport } from "@/components/models/figma-import"  // New import for Figma button
import { IdeasPanel } from "@/components/models/ideas-panel"
interface InputAreaProps {
  isAuthenticated: boolean
}
export function InputArea({ isAuthenticated }: InputAreaProps) {
  const [showIdeas, setShowIdeas] = useState(false)
  const chatInputRef = useRef<ChatInputRef | null>(null)  // Typed ref (no more 'any')
  const handleSelectIdea = (prompt: string) => {
    chatInputRef.current?.insertPrompt(prompt)
  }
  return (
    <div className="w-full">
      <div className="w-full">
        <ChatInput
          {...({ ref: chatInputRef } as any)}
          isAuthenticated={isAuthenticated}
          connected={showIdeas}
          onCloseIdeas={() => setShowIdeas(false)}
        />
      </div>
      {showIdeas && (
        <IdeasPanel
          onSelectIdea={handleSelectIdea}
        />
      )}
      {!showIdeas && isAuthenticated && (
        <div className="flex flex-wrap justify-center items-center gap-3 mt-3 w-full px-4">
          <GithubClone />
          {/* <FigmaImport /> */}
          <button
            onClick={() => setShowIdeas(true)}
            className="hidden h-8 sm:flex text-sm font-medium cursor-pointer border border-[#dbd9d965] py-1 px-4 hover:border-[#ff8c001f] rounded-4xl bg-[#ffffff] text-[#000000] items-center gap-2 w-full sm:w-auto"
          >
            <Lightbulb size={16} className="h-4 w-4" />
            <span className="font-sans font-light">Suggestions</span>
          </button>
        </div>
      )}
    </div>
  )
}