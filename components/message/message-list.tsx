"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ChevronDown, Brain, FileText, Folder, CheckCircle2, XCircle, Loader, List, AlertCircle, Bug, Code } from 'lucide-react'
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useState, useEffect, useCallback } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import remarkGfm from "remark-gfm" // For better Markdown support (tables, etc.)

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  hasArtifact?: boolean
  createdAt?: string
  imageData?: Array<{ url: string; mimeType: string }> | null
  uploadedFiles?: Array<{ name: string; content: string; type: string }> | null
}

interface MessageListProps {
  messages: Message[]
  onArtifactClick?: (artifactId: string) => void
  onCodeExtracted?: (files: Array<{ filename: string; code: string; language: string }>) => void
}

function parseAIResponse(content: string) {
  const sections: {
    thinking?: string
    userMessage?: string
    planning?: string
    search?: string
    fileChecks?: Array<{ file: string; error: string; fix: string; status: string }>
    files?: { name: string; path: string; status: 'success' | 'error' | 'loading' }[]
    responseText?: string
    codeBlocks?: Array<{ filename: string; code: string; language: string }>
  } = {}

  // Extract <Thinking>...</Thinking>
  const thinkingMatch = content.match(/<Thinking>([\s\S]*?)<\/Thinking>/i)
  if (thinkingMatch) {
    sections.thinking = thinkingMatch[1].trim()
  }

  // Extract <UserMessage>...</UserMessage>
  const userMessageMatch = content.match(/<UserMessage>([\s\S]*?)<\/UserMessage>/i)
  if (userMessageMatch) {
    sections.userMessage = userMessageMatch[1].trim()
  }

  // Extract <Planning>...</Planning>
  const planningMatch = content.match(/<Planning>([\s\S]*?)<\/Planning>/i)
  if (planningMatch) {
    sections.planning = planningMatch[1].trim()
  }

  const searchMatch = content.match(/<Search>([\s\S]*?)<\/Search>/i)
  if (searchMatch) {
    sections.search = searchMatch[1].trim()
  }

  // Extract <FileChecks>...</FileChecks>
  const fileChecksMatch = content.match(/<FileChecks>([\s\S]*?)<\/FileChecks>/i)
  if (fileChecksMatch) {
    const checksContent = fileChecksMatch[1]
    sections.fileChecks = []
    // Parse lines like: File: path.tsx - Error: desc - Fix: desc - Status: FIXED
    const checkLines = checksContent.split('\n').filter(line => line.includes('File:') || line.includes('- Error:'))
    let currentFile = ''
    checkLines.forEach(line => {
      if (line.includes('File:')) {
        currentFile = line.match(/File:\s*(.+?)(?:\s*-|$)/)?.[1]?.trim() || ''
      } else if (line.includes('- Error:')) {
        const errorMatch = line.match(/-\s*Error:\s*(.+?)(?:\s*-|$)/)
        const fixMatch = line.match(/-\s*Fix Applied:\s*(.+?)(?:\s*-|$)/)
        const statusMatch = line.match(/-\s*Status:\s*(.+)/)
        if (currentFile && errorMatch) {
          sections.fileChecks!.push({
            file: currentFile,
            error: errorMatch[1].trim(),
            fix: fixMatch ? fixMatch[1].trim() : '',
            status: statusMatch ? statusMatch[1].trim() : 'PENDING'
          })
        }
      }
    })
  }

  // Extract <Files>...</Files> (existing logic)
  const filesMatch = content.match(/<Files>([\s\S]*?)<\/Files>/i)
  if (filesMatch) {
    const filesContent = filesMatch[1]
    sections.files = []
    
    const fileLines = filesContent.split('\n').filter(line => line.trim())
    fileLines.forEach(line => {
      const successMatch = line.match(/(.+?)\s*[✓✔]/i)
      const errorMatch = line.match(/(.+?)\s*[✗✘X]/i)
      const loadingMatch = line.match(/(.+?)\s*[⏳⌛…]/i)
      
      if (successMatch) {
        sections.files!.push({ name: successMatch[1].trim(), path: successMatch[1].trim(), status: 'success' })
      } else if (errorMatch) {
        sections.files!.push({ name: errorMatch[1].trim(), path: errorMatch[1].trim(), status: 'error' })
      } else if (loadingMatch) {
        sections.files!.push({ name: loadingMatch[1].trim(), path: loadingMatch[1].trim(), status: 'loading' })
      }
    })
  }

  // Extract code blocks (existing logic)
  const codeBlockRegex = /\`\`\`(\w+)?\s*(?:file="([^"]+)")?\s*\n([\s\S]*?)\`\`\`/g
  const codeBlocks: Array<{ filename: string; code: string; language: string }> = []
  let match
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || 'typescript'
    const filename = match[2] || `file.${language}`
    const code = match[3].trim()
    codeBlocks.push({ filename, code, language })
  }
  
  if (codeBlocks.length > 0) {
    sections.codeBlocks = codeBlocks
  }

  // Get response text (enhanced: remove all tags AND code blocks)
  let responseText = content
    .replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '')
    .replace(/<UserMessage>[\s\S]*?<\/UserMessage>/gi, '')
    .replace(/<Planning>[\s\S]*?<\/Planning>/gi, '')
    .replace(/<Search>[\s\S]*?<\/Search>/gi, '')
    .replace(/<FileChecks>[\s\S]*?<\/FileChecks>/gi, '')
    .replace(/<Files>[\s\S]*?<\/Files>/gi, '')
    .replace(/\`\`\`[\s\S]*?\`\`\`/g, '')
    .trim()

  if (responseText) {
    sections.responseText = responseText
  }

  return sections
}

export function MessageList({ messages, onArtifactClick, onCodeExtracted }: MessageListProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, Record<string, boolean>>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
  const [selectedCode, setSelectedCode] = useState<{ filename: string; code: string; language: string } | null>(null)
  const [selectedOldCode, setSelectedOldCode] = useState<string | null>(null)
  const [fileHistory, setFileHistory] = useState<Record<string, Array<{ code: string; version: number }>>>({})
  const [fullMessageModal, setFullMessageModal] = useState<Message | null>(null)
  const [modalExpandedSections, setModalExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (messageId: string, section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [messageId]: {
        ...prev[messageId],
        [section]: !prev[messageId]?.[section],
      },
    }))
  }

  const openFullMessageModal = useCallback((message: Message) => {
    const sections = parseAIResponse(message.content)
    const allSections = {
      thinking: !!sections.thinking,
      userMessage: !!sections.userMessage,
      planning: !!sections.planning,
      search: !!sections.search,
      fileChecks: !!sections.fileChecks?.length,
      files: !!sections.files?.length,
      codeBlocks: !!sections.codeBlocks?.length,
    }
    setModalExpandedSections((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(allSections).filter(([, v]) => v).map(([k]) => [k, true])) }))
    setFullMessageModal(message)
  }, [])

  const toggleModalSection = useCallback((section: string) => {
    setModalExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant') {
        const sections = parseAIResponse(lastMessage.content)
        const codeBlocks = sections.codeBlocks
        if (codeBlocks && codeBlocks.length > 0) {
          onCodeExtracted?.(codeBlocks)
          // Update file history
          setFileHistory((prev) => {
            const newHist = { ...prev }
            codeBlocks.forEach((block) => {
              if (!newHist[block.filename]) {
                newHist[block.filename] = []
              }
              const last = newHist[block.filename].length
              const lastCode = newHist[block.filename][last - 1]?.code
              if (lastCode !== block.code) {
                newHist[block.filename].push({ code: block.code, version: last + 1 })
              }
            })
            return newHist
          })
        }
      }
    }
  }, [messages, onCodeExtracted])

  const handleCodeSelect = useCallback((block: { filename: string; code: string; language: string }) => {
    const hist = fileHistory[block.filename] || []
    if (hist.length > 1) {
      const oldCode = hist[hist.length - 2].code
      setSelectedOldCode(oldCode)
    } else {
      setSelectedOldCode(null)
    }
    setSelectedCode(block)
  }, [fileHistory])

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground" role="status" aria-live="polite">
        <p>No messages yet. Start the conversation!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" role="log" aria-live="polite">
      {messages.map((message, index) => {
        const isStreaming = message.id.startsWith("temp-") && index === messages.length - 1

        return (
          <div
            key={`${message.id}-${index}`}
            className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[100%] rounded-lg px-4 py-3",
                message.role === "user" ? "bg-[#e4e4e4] text-[15px] text-black/75" : "text-[15px] text-black",
              )}
              role={message.role === "user" ? "user-message" : "assistant-message"}
              aria-label={`${message.role} message`}
            >
              {message.role === "user" ? (
                <div className="space-y-3">
                  {/* User's uploaded images (existing) */}
                  {message.imageData?.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(img.url)}
                      className="block rounded border border-black/10 hover:border-black/20 transition-colors overflow-hidden"
                      aria-label={`View image ${idx + 1}`}
                    >
                      <img
                        src={img.url || "/placeholder.svg?height=200&width=300"}
                        alt={`Uploaded image ${idx + 1}`}
                        className="max-w-xs max-h-48 object-cover hover:opacity-80 transition-opacity"
                      />
                    </button>
                  ))}
                  
                  {/* User's uploaded files (existing) */}
                  {message.uploadedFiles?.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFile(file)}
                      className="flex items-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded transition-colors text-sm w-full text-left"
                      aria-label={`View file ${file.name}`}
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                  
                  {/* User message with Markdown support for organization/highlighting */}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold text-black">{children}</strong>,
                      em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-black/80">{children}</em>,
                      p: ({ children }: { children?: React.ReactNode }) => <p className="text-sm whitespace-pre-wrap leading-relaxed mb-2">{children}</p>,
                      ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                      ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                      li: ({ children }: { children?: React.ReactNode }) => <li className="text-sm leading-relaxed">{children}</li>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <AIMessageContent
                  message={message}
                  isStreaming={isStreaming}
                  expandedSections={expandedSections[message.id] || {}}
                  onToggleSection={(section) => toggleSection(message.id, section)}
                  onArtifactClick={onArtifactClick}
                  onCodeSelect={handleCodeSelect}
                  onOpenFullModal={() => openFullMessageModal(message)}
                />
              )}
            </div>
          </div>
        )
      })}

      {/* Image Modal (existing) */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
          role="dialog"
          aria-label="Image viewer"
        >
          <div
            className="relative max-w-4xl max-h-full bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 p-2 rounded transition-colors"
              aria-label="Close image"
            >
              <XCircle className="w-4 h-4 text-white" />
            </button>
            <img
              src={selectedImage || "/placeholder.svg"}
              alt="Full view"
              className="w-full h-auto max-h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* File Modal (existing) */}
      {selectedFile && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFile(null)}
          role="dialog"
          aria-label={`File viewer: ${selectedFile.name}`}
        >
          <div
            className="relative max-w-4xl max-h-full bg-[#1E1E21] border border-[#3A3A3E] rounded-lg overflow-hidden flex flex-col w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-[#3A3A3E]">
              <p className="text-sm font-mono text-white truncate">{selectedFile.name}</p>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-2 hover:bg-[#2A2A2E] rounded transition-colors"
                aria-label="Close file"
              >
                <XCircle className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs text-white/75 whitespace-pre-wrap break-words font-mono">
                {selectedFile.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Code Modal */}
      {selectedCode && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSelectedCode(null)
            setSelectedOldCode(null)
          }}
          role="dialog"
          aria-label={`Code viewer: ${selectedCode.filename}`}
        >
          <div
            className="relative max-w-6xl max-h-full bg-[#1E1E21] border border-[#3A3A3E] rounded-lg overflow-hidden flex flex-col w-full h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedOldCode ? (
              <>
                <div className="flex items-center justify-between p-3 border-b border-[#3A3A3E]">
                  <h3 className="text-sm font-mono text-white">Diff View: {selectedCode.filename}</h3>
                  <button
                    onClick={() => {
                      setSelectedCode(null)
                      setSelectedOldCode(null)
                    }}
                    className="p-2 hover:bg-[#2A2A2E] rounded transition-colors"
                    aria-label="Close diff"
                  >
                    <XCircle className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="flex flex-1 overflow-hidden">
                  <div className="w-1/2 flex flex-col border-r border-[#3A3A3E]">
                    <div className="p-2 bg-red-900/20 text-red-300 font-semibold border-b border-red-500/30">Original</div>
                    <div className="flex-1 overflow-auto p-4">
                      {(() => {
                        const oldLines = selectedOldCode.split('\n')
                        const newLines = selectedCode.code.split('\n')
                        const newSet = new Set(newLines)
                        return oldLines.map((line, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-start text-sm leading-relaxed font-mono text-white/80 mb-0.5',
                              !newSet.has(line) && 'bg-red-900/30 border-l-2 border-red-500 pl-2'
                            )}
                          >
                            <span className="w-8 text-right pr-2 text-xs text-gray-500 select-none flex-shrink-0">{i + 1}</span>
                            <span className="flex-1 whitespace-pre">{line}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                  <div className="w-1/2 flex flex-col">
                    <div className="p-2 bg-green-900/20 text-green-300 font-semibold border-b border-green-500/30">Updated</div>
                    <div className="flex-1 overflow-auto p-4">
                      {(() => {
                        const oldLines = selectedOldCode.split('\n')
                        const newLines = selectedCode.code.split('\n')
                        const oldSet = new Set(oldLines)
                        return newLines.map((line, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-start text-sm leading-relaxed font-mono text-white/80 mb-0.5',
                              !oldSet.has(line) && 'bg-green-900/30 border-l-2 border-green-500 pl-2'
                            )}
                          >
                            <span className="w-8 text-right pr-2 text-xs text-gray-500 select-none flex-shrink-0">{i + 1}</span>
                            <span className="flex-1 whitespace-pre">{line}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 border-b border-[#3A3A3E]">
                  <p className="text-sm font-mono text-white truncate">{selectedCode.filename}</p>
                  <button
                    onClick={() => {
                      setSelectedCode(null)
                      setSelectedOldCode(null)
                    }}
                    className="p-2 hover:bg-[#2A2A2E] rounded transition-colors"
                    aria-label="Close code"
                  >
                    <XCircle className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <SyntaxHighlighter
                    language={selectedCode.language}
                    style={oneDark}
                    customStyle={{ margin: 0 }}
                  >
                    {selectedCode.code}
                  </SyntaxHighlighter>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Full AI Message Modal */}
      {fullMessageModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setFullMessageModal(null)}
          role="dialog"
          aria-label="Full AI message viewer"
        >
          <div
            className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden flex flex-col w-full h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-black">Full AI Response</h3>
              <button
                onClick={() => setFullMessageModal(null)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close full message"
              >
                <XCircle className="w-4 h-4 text-black" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AIMessageContent
                message={fullMessageModal}
                isStreaming={false}
                expandedSections={modalExpandedSections}
                onToggleSection={toggleModalSection}
                onArtifactClick={onArtifactClick}
                onCodeSelect={handleCodeSelect}
                onOpenFullModal={() => {}} // No-op in modal to avoid recursion
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AIMessageContent({
  message,
  isStreaming,
  expandedSections,
  onToggleSection,
  onArtifactClick,
  onCodeSelect,
  onOpenFullModal,
}: {
  message: Message
  isStreaming: boolean
  expandedSections: Record<string, boolean>
  onToggleSection: (section: string) => void
  onArtifactClick?: (artifactId: string) => void
  onCodeSelect: (block: { filename: string; code: string; language: string }) => void
  onOpenFullModal: () => void
}) {
  const sections = parseAIResponse(message.content)

  const markdownComponents = {
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold text-black bg-[#e4e4e4] px-1.5 py-1 rounded text-sm">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-black/80">{children}</em>,
    p: ({ children }: { children?: React.ReactNode }) => <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2">{children}</p>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-5 space-y-1 mb-2">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-5 space-y-1 mb-2">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="text-sm leading-relaxed">{children}</li>,
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) => <code className={cn("bg-gray-100 px-1 py-0.5 rounded text-xs font-mono", className)}>{children}</code>,
  }

  return (
    <div className="space-y-3 w-full">
      {/* Thinking Button (existing) */}
      {sections.thinking && (
        <Collapsible
          open={expandedSections.thinking ?? false}
          onOpenChange={() => onToggleSection('thinking')}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              aria-expanded={expandedSections.thinking}
              aria-controls={`thinking-${message.id}`}
            >
              <div className="relative w-4 h-4">
                <Brain
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-100 translate-y-0",
                    expandedSections.thinking ? "opacity-0 -translate-y-1" : "",
                    "group-hover:opacity-0 group-hover:-translate-y-1",
                  )}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-0 translate-y-1",
                    expandedSections.thinking ? "opacity-100 translate-y-0" : "",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    expandedSections.thinking && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span>Thinking</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
              <div className="p-1 ">
                <span className="text-[14px] text-[#2e2e2e]">{sections.thinking}</span>
              </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* User Message Button (existing, renamed to "Read" for understanding) */}
      {sections.userMessage && (
        <Collapsible
          open={expandedSections.userMessage ?? false}
          onOpenChange={() => onToggleSection('userMessage')}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              aria-expanded={expandedSections.userMessage}
              aria-controls={`userMessage-${message.id}`}
            >
              <div className="relative w-4 h-4">
                <FileText
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-100 translate-y-0",
                    expandedSections.userMessage ? "opacity-0 -translate-y-1" : "",
                    "group-hover:opacity-0 group-hover:-translate-y-1",
                  )}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-0 translate-y-1",
                    expandedSections.userMessage ? "opacity-100 translate-y-0" : "",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    expandedSections.userMessage && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span>Read</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
              <div className="p-1 ">
                <span className="text-[14px] text-[#2e2e2e]">{sections.userMessage}</span>
              </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Planning Button (existing) */}
      {sections.planning && (
        <Collapsible
          open={expandedSections.planning ?? false}
          onOpenChange={() => onToggleSection('planning')}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              aria-expanded={expandedSections.planning}
              aria-controls={`planning-${message.id}`}
            >
              <div className="relative w-4 h-4">
                <List
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-100 translate-y-0",
                    expandedSections.planning ? "opacity-0 -translate-y-1" : "",
                    "group-hover:opacity-0 group-hover:-translate-y-1",
                  )}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-0 translate-y-1",
                    expandedSections.planning ? "opacity-100 translate-y-0" : "",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    expandedSections.planning && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span>Planning</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
              <div className="p-1 ">
                <span className="text-[14px] text-[#2e2e2e]">{sections.planning}</span>
              </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Search Button (existing) */}
      {sections.search && (
        <Collapsible
          open={expandedSections.search ?? false}
          onOpenChange={() => onToggleSection('search')}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              aria-expanded={expandedSections.search}
              aria-controls={`search-${message.id}`}
            >
              <div className="relative w-4 h-4">
                <FileText
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-100 translate-y-0",
                    expandedSections.search ? "opacity-0 -translate-y-1" : "",
                    "group-hover:opacity-0 group-hover:-translate-y-1",
                  )}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-0 translate-y-1",
                    expandedSections.search ? "opacity-100 translate-y-0" : "",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    expandedSections.search && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span>Search Results</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
              <div className="p-1 ">
                <span className="text-[14px] text-[#2e2e2e] font-light">{sections.search}</span>
              </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* New: File Checks Button */}
      {sections.fileChecks && sections.fileChecks.length > 0 && (
        <Collapsible
          open={expandedSections.fileChecks ?? false}
          onOpenChange={() => onToggleSection('fileChecks')}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              aria-expanded={expandedSections.fileChecks}
              aria-controls={`fileChecks-${message.id}`}
            >
              <div className="relative w-4 h-4">
                <Bug
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-100 translate-y-0",
                    expandedSections.fileChecks ? "opacity-0 -translate-y-1" : "",
                    "group-hover:opacity-0 group-hover:-translate-y-1",
                  )}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-0 translate-y-1",
                    expandedSections.fileChecks ? "opacity-100 translate-y-0" : "",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    expandedSections.fileChecks && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span>File Checks {sections.fileChecks.length}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-2 p-2 border rounded-sm bg-red-50/50">
              {sections.fileChecks.map((check, idx) => (
                <div key={idx} className="bg-white p-3 rounded border-l-4 border-red-400 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="font-mono text-sm text-red-800">{check.file}</span>
                  </div>
                  <p className="text-xs text-red-700"><strong>Error:</strong> {check.error}</p>
                  {check.fix && <p className="text-xs text-green-700"><strong>Fix:</strong> {check.fix}</p>}
                  <p className="text-xs text-gray-600"><strong>Status:</strong> <span className={cn("font-semibold", check.status === "FIXED" ? "text-green-600" : "text-yellow-600")}>{check.status}</span></p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Response Text with Markdown for highlighting/organization - now without inline code blocks */}
      {sections.responseText && (
        <div className="prose prose-sm max-w-none text-black/75">
          {isStreaming && !sections.responseText ? (
            <div className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Generating response...</span>
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {sections.responseText}
            </ReactMarkdown>
          )}
          {isStreaming && sections.responseText && (
            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
          )}
        </div>
      )}

      {/* Files Section (existing, but uncommented and always open by default if present) */}
      {sections.files && sections.files.length > 0 && (
        <Collapsible
          open={expandedSections.files ?? true}
          onOpenChange={() => onToggleSection('files')}
        >
          <CollapsibleTrigger asChild>
            {/* <Button
              variant="ghost"
              size="sm"
              className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              aria-expanded={expandedSections.files}
              aria-controls={`files-${message.id}`}
            >
              <div className="relative w-4 h-4">
                <Folder
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-100 translate-y-0",
                    expandedSections.files ? "opacity-0 -translate-y-1" : "",
                    "group-hover:opacity-0 group-hover:-translate-y-1",
                  )}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-0 translate-y-1",
                    expandedSections.files ? "opacity-100 translate-y-0" : "",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    expandedSections.files && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span>Files {sections.files.length}</span>
            </Button> */}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
                <div className="space-y-2 p-1 bg-white w-full rounded-sm shadow-[0px_0px_10px_0px_white]">
                  <h1 className="font-light flex items-center gap-[5px] ml-2 mt-1"><List className="h-4 w-4"/>Plan</h1>
                  {sections.files.map((file, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-2 text-sm rounded-sm cursor-pointer hover:bg-[#e4e4e48c] py-1.5 px-3 hover:underline"
                      onClick={onOpenFullModal}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open full message for file ${file.path}`}
                    >
                      <span className="font-mono text-xs text-black/70">{file.path}</span>
                    </div>
                  ))}
                </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* New: Code Artifacts Section */}
      {sections.codeBlocks && sections.codeBlocks.length > 0 && (
        <Collapsible
          open={expandedSections.codeBlocks ?? false}
          onOpenChange={() => onToggleSection('codeBlocks')}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              aria-expanded={expandedSections.codeBlocks}
              aria-controls={`codeBlocks-${message.id}`}
            >
              <div className="relative w-4 h-4">
                <Code
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-100 translate-y-0",
                    expandedSections.codeBlocks ? "opacity-0 -translate-y-1" : "",
                    "group-hover:opacity-0 group-hover:-translate-y-1",
                  )}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={cn(
                    "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                    "opacity-0 translate-y-1",
                    expandedSections.codeBlocks ? "opacity-100 translate-y-0" : "",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    expandedSections.codeBlocks && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span>Code Artifacts {sections.codeBlocks.length}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-3">
              {sections.codeBlocks.map((block, idx) => (
                <div
                  key={idx}
                  className="cursor-pointer bg-[#ffffff] rounded-md border border-[#e4e4e496]"
                  onClick={() => onCodeSelect(block)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View full code for ${block.filename}`}
                >
                  <div className="p-3 border-b border-gray-200 bg-[#e4e4e496]">
                    <h3 className="font-mono text-sm font-semibold text-black/80 truncate">{block.filename}</h3>
                  </div>
                  <CardContent className="p-3 max-h-[150px] overflow-y-auto">
                    <SyntaxHighlighter
                      language={block.language}
                      style={oneDark}
                      customStyle={{ margin: 0, padding: "8px 0", borderRadius: 0 }}
                    >
                      {block.code}
                    </SyntaxHighlighter>
                  </CardContent>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}