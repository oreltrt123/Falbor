"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  ChevronDown,
  Brain,
  FileText,
  CheckCircle2,
  XCircle,
  List,
  AlertCircle,
  Bug,
  Copy,
  Globe,
  ChevronRight,
  Folder,
  Search,
  ChevronUp,
  Lightbulb,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useState, useEffect, useCallback } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import remarkGfm from "remark-gfm"
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react"
import { useUser } from "@clerk/nextjs"

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
  projectId: string
  onArtifactClick?: (artifactId: string) => void
  onCodeExtracted?: (files: Array<{ filename: string; code: string; language: string }>) => void
  onCopy?: (content: string) => void
  onEdit?: (id: string, content: string) => void
  onRegenerate?: (id: string) => void
  onOpenPreview?: (
    version: string,
    project: string,
    codeBlocks: Array<{ filename: string; code: string; language: string }>,
  ) => void
}

interface TextPart {
  type: "text"
  content: string
}

interface DesignPart {
  type: "design"
  content: { name: string; config: any; json: string }
}

type UserPart = TextPart | DesignPart

function parseAIResponse(content: string) {
  const tagRegexes: Record<string, RegExp> = {
    thinking: /<Thinking>([\s\S]*?)<\/Thinking>/gi,
    commentary: /<commentary>([\s\S]*?)<\/commentary>/gi,
    userMessage: /<UserMessage>([\s\S]*?)<\/UserMessage>/gi,
    planning: /<Planning>([\s\S]*?)<\/Planning>/gi,
    search: /<Search>([\s\S]*?)<\/Search>/gi,
    fileChecks: /<FileChecks>([\s\S]*?)<\/FileChecks>/gi,
    files: /<Files>([\s\S]*?)<\/Files>/gi,
    previewButton: /<PreviewButton version="([^"]+)" project="([^"]+)">([\s\S]*?)<\/PreviewButton>/gi,
    importCard: /<ImportCard repo="([^"]+)" \/>/gi,
    testing: /<Testing>([\s\S]*?)<\/Testing>/gi,
  }

  const codeRegex = /```(\w+)?\s*(?:file="([^"]+)")?\s*\n([\s\S]*?)```/g

  const matches: Array<{ type: string; start: number; fullMatch: string; content: any }> = []

  for (const [type, regex] of Object.entries(tagRegexes)) {
    for (const match of content.matchAll(regex)) {
      let parsedContent: any
      if (type === "previewButton") {
        parsedContent = { version: match[1], project: match[2], text: match[3].trim() }
      } else if (type === "importCard") {
        parsedContent = { repo: match[1] }
      } else if (type === "fileChecks") {
        const checksContent = match[1].trim()
        const checks: Array<{ file: string; error: string; fix: string; status: string }> = []
        const checkLines = checksContent
          .split("\n")
          .filter((line) => line.includes("File:") || line.includes("- Error:"))
        let currentFile = ""
        checkLines.forEach((line) => {
          if (line.includes("File:")) {
            currentFile = line.match(/File:\s*(.+?)(?:\s*-|$)/)?.[1]?.trim() || ""
          } else if (line.includes("- Error:")) {
            const errorMatch = line.match(/-\s*Error:\s*(.+?)(?:\s*-|$)/)
            const fixMatch = line.match(/-\s*Fix Applied:\s*(.+?)(?:\s*-|$)/)
            const statusMatch = line.match(/-\s*Status:\s*(.+)/)
            if (currentFile && errorMatch) {
              checks.push({
                file: currentFile,
                error: errorMatch[1].trim(),
                fix: fixMatch ? fixMatch[1].trim() : "",
                status: statusMatch ? statusMatch[1].trim() : "PENDING",
              })
            }
          }
        })
        parsedContent = checks
      } else if (type === "files") {
        const filesContent = match[1].trim()
        const filesList: { name: string; path: string; status: "success" | "error" | "loading" }[] = []
        const fileLines = filesContent.split("\n").filter((line) => line.trim())
        fileLines.forEach((line) => {
          const successMatch = line.match(/(.+?)\s*[✓✔]/i)
          const errorMatch = line.match(/(.+?)\s*[✗✘X]/i)
          const loadingMatch = line.match(/(.+?)\s*[⏳⌛…]/i)
          if (successMatch) {
            filesList.push({ name: successMatch[1].trim(), path: successMatch[1].trim(), status: "success" })
          } else if (errorMatch) {
            filesList.push({ name: errorMatch[1].trim(), path: errorMatch[1].trim(), status: "error" })
          } else if (loadingMatch) {
            filesList.push({ name: loadingMatch[1].trim(), path: loadingMatch[1].trim(), status: "loading" })
          }
        })
        parsedContent = filesList
      } else if (type === "testing") {
        parsedContent = match[1].trim()
      } else {
        parsedContent = match[1].trim()
      }
      matches.push({ type, start: match.index!, fullMatch: match[0], content: parsedContent })
    }
  }

  for (const match of content.matchAll(codeRegex)) {
    const language = match[1] || "typescript"
    const filename = match[2] || `file.${language}`
    const code = match[3].trim()
    matches.push({
      type: "codeBlock",
      start: match.index!,
      fullMatch: match[0],
      content: { filename, code, language },
    })
  }

  matches.sort((a, b) => a.start - b.start)

  const parts: Array<{ type: string; content: any }> = []
  const codeBlocks: Array<{ filename: string; code: string; language: string }> = []
  let lastEnd = 0
  for (const m of matches) {
    const textBefore = content.substring(lastEnd, m.start).trim()
    if (textBefore) {
      parts.push({ type: "text", content: textBefore })
    }
    if (m.type === "codeBlock") {
      codeBlocks.push(m.content)
    } else {
      parts.push({ type: m.type, content: m.content })
    }
    lastEnd = m.start + m.fullMatch.length
  }
  let finalText = content.substring(lastEnd).trim()

  // Handle incomplete (open) tags at the end for streaming
  if (finalText) {
    const simpleTypes = ["thinking", "commentary", "userMessage", "planning", "search", "fileChecks", "files", "testing"];
    for (const type of simpleTypes) {
      const openRegex = new RegExp(`<${type.charAt(0).toUpperCase() + type.slice(1)}>([\\s\\S]*)`, "i");
      const match = finalText.match(openRegex);
      if (match && match.index === 0) {
        let parsedContent = match[1].trim();
        // Special parsing for fileChecks, files, etc., if needed (similar to above)
        if (type === "fileChecks") {
          // Reuse the parsing logic from above, adapted for incomplete
          const checksContent = parsedContent;
          const checks: Array<{ file: string; error: string; fix: string; status: string }> = [];
          const checkLines = checksContent.split("\n").filter((line) => line.includes("File:") || line.includes("- Error:"));
          let currentFile = "";
          checkLines.forEach((line) => {
            if (line.includes("File:")) {
              currentFile = line.match(/File:\s*(.+?)(?:\s*-|$)/)?.[1]?.trim() || "";
            } else if (line.includes("- Error:")) {
              const errorMatch = line.match(/-\s*Error:\s*(.+?)(?:\s*-|$)/);
              const fixMatch = line.match(/-\s*Fix Applied:\s*(.+?)(?:\s*-|$)/);
              const statusMatch = line.match(/-\s*Status:\s*(.+)/);
              if (currentFile && errorMatch) {
                checks.push({
                  file: currentFile,
                  error: errorMatch[1].trim(),
                  fix: fixMatch ? fixMatch[1].trim() : "",
                  status: statusMatch ? statusMatch[1].trim() : "PENDING",
                });
              }
            }
          });
        } else if (type === "files") {
          // Reuse files parsing
          const filesContent = parsedContent;
          const filesList: { name: string; path: string; status: "success" | "error" | "loading" }[] = [];
          const fileLines = filesContent.split("\n").filter((line) => line.trim());
          fileLines.forEach((line) => {
            const successMatch = line.match(/(.+?)\s*[✓✔]/i);
            const errorMatch = line.match(/(.+?)\s*[✗✘X]/i);
            const loadingMatch = line.match(/(.+?)\s*[⏳⌛…]/i);
            if (successMatch) {
              filesList.push({ name: successMatch[1].trim(), path: successMatch[1].trim(), status: "success" });
            } else if (errorMatch) {
              filesList.push({ name: errorMatch[1].trim(), path: errorMatch[1].trim(), status: "error" });
            } else if (loadingMatch) {
              filesList.push({ name: loadingMatch[1].trim(), path: loadingMatch[1].trim(), status: "loading" });
            }
          });
        }
        parts.push({ type, content: parsedContent });
        finalText = "";
        break;
      }
    }
    if (finalText) {
      parts.push({ type: "text", content: finalText });
    }
  }

  return { parts, codeBlocks }
}

function parseUserContent(content: string): { parts: UserPart[] } {
  const designRegex = /## Design System: ([\w\s]+)\n([\s\S]*)/i
  const match = content.match(designRegex)
  if (match) {
    const mainContent = content.slice(0, match.index).trim()
    const designName = match[1].trim()
    const designJson = match[2].trim()
    let designConfig
    try {
      designConfig = JSON.parse(designJson)
    } catch (e) {
      console.error("Failed to parse design JSON:", e)
      designConfig = null
    }
    return {
      parts: [
        { type: "text", content: mainContent },
        { type: "design", content: { name: designName, config: designConfig, json: designJson } },
      ],
    }
  }
  return { parts: [{ type: "text", content: content.trim() }] }
}

export function MessageList({
  messages,
  projectId,
  onArtifactClick,
  onCodeExtracted,
  onCopy,
  onEdit,
  onRegenerate,
  onOpenPreview,
}: MessageListProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, Record<string, boolean>>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
  const [selectedCode, setSelectedCode] = useState<{ filename: string; code: string; language: string } | null>(null)
  const [selectedOldCode, setSelectedOldCode] = useState<string | null>(null)
  const [fileHistory, setFileHistory] = useState<Record<string, Array<{ code: string; version: number }>>>({})
  const [fullMessageModal, setFullMessageModal] = useState<Message | null>(null)
  const [modalExpandedSections, setModalExpandedSections] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<string>("")
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})
  const { user, isLoaded } = useUser()

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
    const { parts } = parseAIResponse(message.content)
    const collapsibleTypes = [
      "thinking",
      "commentary",
      "userMessage",
      "planning",
      "search",
      "fileChecks",
      "files",
      "importCard",
      "testing",
    ]
    let collapsibleIndex = 0
    const initialExpanded: Record<string, boolean> = {}
    parts.forEach((part) => {
      if (collapsibleTypes.includes(part.type)) {
        initialExpanded[`section-${collapsibleIndex}`] = true
        collapsibleIndex++
      }
    })
    setModalExpandedSections(initialExpanded)
    setFullMessageModal(message)
  }, [])

  const toggleModalSection = useCallback((section: string) => {
    setModalExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }, [])

  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        onCopy?.(text)
      } catch (err) {
        console.error("Failed to copy text: ", err)
      }
    },
    [onCopy],
  )

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "assistant") {
        const { codeBlocks } = parseAIResponse(lastMessage.content)
        if (codeBlocks && codeBlocks.length > 0) {
          onCodeExtracted?.(codeBlocks)
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

  const handleCodeSelect = useCallback(
    (block: { filename: string; code: string; language: string }) => {
      const hist = fileHistory[block.filename] || []
      if (hist.length > 1) {
        const oldCode = hist[hist.length - 2].code
        setSelectedOldCode(oldCode)
      } else {
        setSelectedOldCode(null)
      }
      setSelectedCode(block)
    },
    [fileHistory],
  )

  const toggleMessageExpand = (messageId: string) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground" role="status" aria-live="polite">
        <p>No messages yet. Start the conversation!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3" role="log" aria-live="polite">
      {messages.map((message, index) => {
        const isStreaming = message.id.startsWith("temp-") && index === messages.length - 1
        const isEditing = editingId === message.id

        const isTerminalErrorResponse =
          message.role === "assistant" &&
          index > 0 &&
          messages[index - 1].role === "user" &&
          messages[index - 1].content.startsWith("[TERMINAL_ERROR_FIX]")

        const messageWrapperClass = cn(
          "relative max-w-[100%] rounded-lg px-4 py-3",
          message.role === "user" ? "bg-[#e4e4e4a8] text-[15px] text-black w-full" : "text-[15px] text-black",
        )

        const renderedMessage = (
          <div
            className={messageWrapperClass}
            role={message.role === "user" ? "user-message" : "assistant-message"}
            aria-label={`${message.role} message`}
          >
            {message.role === "user" ? (
              <div className="flex items-start gap-2 w-full">
                <img
                  src={user?.imageUrl || "/placeholder.svg"}
                  alt={user?.firstName || "User"}
                  className="w-8 h-8 rounded-full flex-shrink-0 mt-1"
                  style={{ marginLeft: "-3px" }}
                />
                <div className="flex-1 space-y-2">
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

                  {isEditing ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          onEdit?.(message.id, editContent)
                          setEditingId(null)
                        } else if (e.key === "Escape") {
                          setEditingId(null)
                        }
                      }}
                      className="w-full p-2 border rounded resize-none text-sm bg-white text-black/75"
                      placeholder="Edit your message..."
                      autoFocus
                      rows={3}
                    />
                  ) : (
                    <>
                      {(() => {
                        const { parts } = parseUserContent(message.content)
                        return parts.map((part, partIdx) => {
                          if (part.type === "text") {
                            const isLong = part.content.length > 200
                            const isExpanded = expandedMessages[message.id] ?? false
                            return (
                              <div
                                key={partIdx}
                                className={cn(
                                  isLong &&
                                    !isExpanded &&
                                    "max-h-32 overflow-hidden relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-8 after:bg-gradient-to-t after:to-transparent",
                                )}
                              >
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    strong: ({ children }: { children?: React.ReactNode }) => (
                                      <strong className="font-bold text-black">{children}</strong>
                                    ),
                                    em: ({ children }: { children?: React.ReactNode }) => (
                                      <em className="italic text-black/80">{children}</em>
                                    ),
                                    p: ({ children }: { children?: React.ReactNode }) => (
                                      <p className="text-sm whitespace-pre-wrap leading-relaxed mb-1 last:mb-0">
                                        {children}
                                      </p>
                                    ),
                                    ul: ({ children }: { children?: React.ReactNode }) => (
                                      <ul className="list-disc pl-5 space-y-1 mb-1 last:mb-0">{children}</ul>
                                    ),
                                    ol: ({ children }: { children?: React.ReactNode }) => (
                                      <ol className="list-decimal pl-5 space-y-1 mb-1 last:mb-0">{children}</ol>
                                    ),
                                    li: ({ children }: { children?: React.ReactNode }) => (
                                      <li className="text-sm leading-relaxed">{children}</li>
                                    ),
                                  }}
                                >
                                  {part.content}
                                </ReactMarkdown>
                              </div>
                            )
                          }
                          return null
                        })
                      })()}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full">
                <AIMessageContent
                  message={message}
                  isStreaming={isStreaming}
                  expandedSections={expandedSections[message.id] || {}}
                  onToggleSection={(section) => toggleSection(message.id, section)}
                  onArtifactClick={onArtifactClick}
                  onCodeSelect={handleCodeSelect}
                  onOpenFullModal={() => openFullMessageModal(message)}
                  onOpenPreview={onOpenPreview}
                />
              </div>
            )}

            {message.role === "user" ? (
              <div className="absolute top-2 right-1 flex items-center gap-1">
                {message.content.length > 200 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => toggleMessageExpand(message.id)}
                    className="p-0 h-auto text-black/70 flex items-center gap-1 cursor-pointer"
                  >
                    {expandedMessages[message.id] ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <>
                {!isStreaming && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const sections = parseAIResponse(message.content)
                        const textToCopy =
                          sections.parts
                            .filter((p) => p.type === "text")
                            .map((p) => p.content)
                            .join("\n") || message.content
                        handleCopy(textToCopy)
                      }}
                      className="h-6 w-6 p-0 hover:bg-[#e4e4e4]"
                      aria-label="Copy response"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )

        return (
          <div
            key={`${message.id}-${index}`}
            className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}
          >
            {isTerminalErrorResponse ? (
              <div className="w-full bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-4">
                <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Terminal Error Explanation & Fix
                </h3>
                {renderedMessage}
              </div>
            ) : (
              renderedMessage
            )}
          </div>
        )
      })}

      {/* Image Modal */}
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

      {/* File Modal */}
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
                    <div className="p-2 bg-red-900/20 text-red-300 font-semibold border-b border-red-500/30">
                      Original
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      {(() => {
                        const oldLines = selectedOldCode.split("\n")
                        const newLines = selectedCode.code.split("\n")
                        const newSet = new Set(newLines)
                        return oldLines.map((line, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-start text-sm leading-relaxed font-mono text-white/80 mb-0.5",
                              !newSet.has(line) && "bg-red-900/30 border-l-2 border-red-500 pl-2",
                            )}
                          >
                            <span className="w-8 text-right pr-2 text-xs text-gray-500 select-none flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="flex-1 whitespace-pre">{line}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                  <div className="w-1/2 flex flex-col">
                    <div className="p-2 bg-green-900/20 text-green-300 font-semibold border-b border-green-500/30">
                      Updated
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      {(() => {
                        const oldLines = selectedOldCode.split("\n")
                        const newLines = selectedCode.code.split("\n")
                        const oldSet = new Set(oldLines)
                        return newLines.map((line, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-start text-sm leading-relaxed font-mono text-white/80 mb-0.5",
                              !oldSet.has(line) && "bg-green-900/30 border-l-2 border-green-500 pl-2",
                            )}
                          >
                            <span className="w-8 text-right pr-2 text-xs text-gray-500 select-none flex-shrink-0">
                              {i + 1}
                            </span>
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
                  <SyntaxHighlighter language={selectedCode.language} style={oneDark} customStyle={{ margin: 0 }}>
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
                onOpenFullModal={() => {}}
                onOpenPreview={onOpenPreview}
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
  onOpenPreview,
}: {
  message: Message
  isStreaming: boolean
  expandedSections: Record<string, boolean>
  onToggleSection: (section: string) => void
  onArtifactClick?: (artifactId: string) => void
  onCodeSelect: (block: { filename: string; code: string; language: string }) => void
  onOpenFullModal: () => void
  onOpenPreview?: (
    version: string,
    project: string,
    codeBlocks: Array<{ filename: string; code: string; language: string }>,
  ) => void
}) {
  const { parts, codeBlocks } = parseAIResponse(message.content)

  const markdownComponents = {
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-black bg-[#e4e4e4] px-1.5 py-1 rounded text-sm">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-black/80">{children}</em>,
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-sm leading-relaxed whitespace-pre-wrap mb-1 last:mb-0">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc pl-5 space-y-1 mb-1 last:mb-0">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-5 space-y-1 mb-1 last:mb-0">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => <li className="text-sm leading-relaxed">{children}</li>,
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <code className={cn("bg-gray-100 px-1 py-0.5 rounded text-xs font-mono", className)}>{children}</code>
    ),
  }

  const getTitle = (type: string, content: any) => {
    switch (type) {
      case "thinking":
        return "Thinking"
      case "commentary":
        return "Commentary"
      case "userMessage":
        return "Read"
      case "planning":
        return "Planning"
      case "search":
        return "Search Results"
      case "fileChecks":
        return `File Checks ${content.length}`
      case "files":
        return `Files ${content.length}`
      case "importCard":
        return "Importing GitHub Repository"
      case "testing":
        return "Live Testing"
      default:
        return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "thinking":
      case "commentary":
        return Brain
      case "userMessage":
        return FileText
      case "search":
        return Search
      case "planning":
        return Lightbulb
      case "fileChecks":
        return Bug
      case "files":
        return Folder
      case "importCard":
        return Globe
      case "testing":
        return Globe
      default:
        return FileText
    }
  }

  const renderPartContent = (type: string, content: any) => {
    switch (type) {
      case "thinking":
      case "commentary":
      case "userMessage":
      case "planning":
      case "search":
        return (
          <div className="p-1">
            <span className="text-[14px] text-[#2e2e2e]">{content}</span>
          </div>
        )
      case "fileChecks":
        return (
          <div className="space-y-2 p-2 border rounded-sm bg-red-50/50">
            {content.map((check: { file: string; error: string; fix: string; status: string }, idx: number) => (
              <div key={idx} className="bg-white p-3 rounded border-l-4 border-red-400 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="font-mono text-sm text-red-800">{check.file}</span>
                </div>
                <p className="text-xs text-red-700">
                  <strong>Error:</strong> {check.error}
                </p>
                {check.fix && (
                  <p className="text-xs text-green-700">
                    <strong>Fix:</strong> {check.fix}
                  </p>
                )}
                <p className="text-xs text-gray-600">
                  <strong>Status:</strong>{" "}
                  <span
                    className={cn("font-semibold", check.status === "FIXED" ? "text-green-600" : "text-yellow-600")}
                  >
                    {check.status}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )
      case "files":
        return (
          <div className="space-y-2 p-1 bg-[#bebaba18] border w-full rounded-sm shadow-[0px_0px_10px_0px_white]">
            <h1 className="font-light flex items-center gap-[5px] ml-2 mt-1">
              <List className="h-4 w-4" />
              Plan files
            </h1>
            {content.map((file: { name: string; path: string; status: string }, idx: number) => (
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
        )
      case "importCard":
        return (
          <div className="mt-1 bg-[#e4e4e4] rounded-b-md px-3 py-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span>Import {content.repo}</span>
            </div>
          </div>
        )
      case "testing":
        return (
          <div className="mt-2 p-2">
            <div className="w-64 h-64 bg-white border overflow-hidden">
              <SandpackProvider
                files={codeBlocks.reduce((acc: Record<string, string>, block) => {
                  acc[`/${block.filename}`] = block.code
                  return acc
                }, {})}
                template="react-ts"
                theme="light"
              >
                <SandpackPreview style={{ height: "100%" }} />
              </SandpackProvider>
            </div>
            <p className="mt-2 text-sm text-gray-600">{content}</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-3 w-full">
      {parts.map((part, idx) => {
        if (part.type === "text") {
          return (
            <div key={idx} className="prose prose-sm max-w-none text-black/75">
              {isStreaming && parts.filter((p) => p.type === "text").every((p) => !p.content) ? (
                <div className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Generating response...</span>
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {part.content}
                </ReactMarkdown>
              )}
            </div>
          )
        } else if (part.type === "previewButton") {
          return (
            <div key={idx} className="mt-4">
              <Button
                onClick={() => onOpenPreview?.(part.content.version, part.content.project, codeBlocks)}
                className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
              >
                <div className="relative w-4 h-4">
                  <Globe
                    className={cn(
                      "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                      "opacity-100 translate-y-0",
                      "group-hover:opacity-0 group-hover:-translate-y-1",
                    )}
                    aria-hidden="true"
                  />
                  <ChevronRight
                    className={cn(
                      "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                      "opacity-0 translate-y-1",
                      "group-hover:opacity-100 group-hover:translate-y-0",
                    )}
                    aria-hidden="true"
                  />
                </div>
                {part.content.text}
              </Button>
            </div>
          )
        } else {
          const collapsibleTypes = [
            "thinking",
            "commentary",
            "userMessage",
            "planning",
            "search",
            "fileChecks",
            "files",
            "importCard",
            "testing",
          ]
          if (!collapsibleTypes.includes(part.type)) return null

          const collapsibleIndex = parts.slice(0, idx).filter((p) => collapsibleTypes.includes(p.type)).length
          const sectionKey = `section-${collapsibleIndex}`

          const isLastPart = idx === parts.length - 1
          const isOpen = expandedSections[sectionKey] ?? (isStreaming && isLastPart ? true : false)
          const title = getTitle(part.type, part.content)
          const Icon = getIcon(part.type)

          return (
            <Collapsible key={idx} open={isOpen} onOpenChange={() => onToggleSection(sectionKey)}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative cursor-pointer flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-black/75 hover:text-black bg-transparent hover:bg-transparent border-none p-0 h-auto group"
                  aria-expanded={isOpen}
                  aria-controls={`${part.type}-${message.id}-${collapsibleIndex}`}
                >
                  <div className="relative w-4 h-4">
                    <Icon
                      className={cn(
                        "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                        "opacity-100 translate-y-0",
                        isOpen ? "opacity-0 -translate-y-1" : "",
                        "group-hover:opacity-0 group-hover:-translate-y-1",
                      )}
                      aria-hidden="true"
                    />
                    <ChevronDown
                      className={cn(
                        "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
                        "opacity-0 translate-y-1",
                        isOpen ? "opacity-100 translate-y-0" : "",
                        "group-hover:opacity-100 group-hover:translate-y-0",
                        isOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <span>{title}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">{renderPartContent(part.type, part.content)}</CollapsibleContent>
            </Collapsible>
          )
        }
      })}
      {isStreaming && parts.some((p) => p.type === "text" && p.content) && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
      )}
    </div>
  )
}