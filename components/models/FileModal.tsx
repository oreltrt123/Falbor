"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from 'lucide-react'
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

interface FileModalProps {
  open: boolean
  onClose: () => void
  fileName: string
  fileContent: string
}

export function FileModal({ open, onClose, fileName, fileContent }: FileModalProps) {
  const getLanguageFromFileName = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase()
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
    return langMap[ext || ''] || 'text'
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-mono">{fileName}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <SyntaxHighlighter
            language={getLanguageFromFileName(fileName)}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '1.5rem',
              background: '#1E1E21',
              fontSize: '0.875rem',
            }}
            showLineNumbers
          >
            {fileContent}
          </SyntaxHighlighter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
