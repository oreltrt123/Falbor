"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, X } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

interface FileUploadButtonProps {
  file: { name: string; content: string; type: string }
  onRemove: () => void
  size?: "sm" | "md"
}

export function FileUploadButton({ file, onRemove, size = "md" }: FileUploadButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const getLanguageFromFilename = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'tsx',
      'js': 'javascript',
      'jsx': 'jsx',
      'py': 'python',
      'css': 'css',
      'html': 'html',
      'json': 'json',
      'md': 'markdown',
    }
    return langMap[ext || ''] || 'typescript'
  }

  return (
    <>
      <div className={cn(
        "flex items-center gap-2 bg-white border border-[#d6d6d6] rounded-md overflow-hidden",
        size === "sm" ? "px-2 py-1" : "px-3 py-2"
      )}>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        >
          <FileText className={cn("flex-shrink-0", size === "sm" ? "w-3 h-3" : "w-4 h-4")} />
          <span className={cn("truncate max-w-[200px] font-mono", size === "sm" ? "text-xs" : "text-sm")}>
            {file.name}
          </span>
        </button>
        <button
          onClick={onRemove}
          className="ml-auto hover:bg-red-50 rounded p-0.5 transition-colors"
          aria-label="Remove file"
        >
          <X className="w-3.5 h-3.5 text-red-600" />
        </button>
      </div>

      {/* Code Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-[#1E1E1E] border border-[#3A3A3E] rounded-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-[#3A3A3E] bg-[#252526]">
              <p className="text-sm font-mono text-white truncate">{file.name}</p>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[#3A3A3E] rounded transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SyntaxHighlighter
                language={getLanguageFromFilename(file.name)}
                style={oneDark}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem',
                  background: '#1E1E1E',
                  fontSize: '13px',
                }}
                showLineNumbers
              >
                {file.content}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
