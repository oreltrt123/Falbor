"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Code2, Loader2, ChevronDown, ChevronRight, Search, Brain, FileText, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useState, useEffect, useRef } from "react"

interface File {
  id: string
  path: string
  additions: number
  deletions: number
}

interface SearchQuery {
  query: string
  results: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  hasArtifact?: boolean
  thinking?: string | null
  searchQueries?: SearchQuery[] | null
  createdAt: string
  files?: File[]
  imageData?: Array<{ url: string; mimeType: string }> | null
  uploadedFiles?: Array<{ name: string; content: string; type: string }> | null
}

interface MessageListProps {
  messages: Message[]
  onArtifactClick?: (artifactId: string) => void
}

export function MessageList({ messages, onArtifactClick }: MessageListProps) {
  const [expandedThinking, setExpandedThinking] = useState<string | null>(null)
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
  const [autoExpanded, setAutoExpanded] = useState<Record<string, boolean>>({}) // Per-message auto-expand state
  const streamingRef = useRef<Record<string, { thinking: string; searchQueries: SearchQuery[] }>>({}) // Per-message ref

  // FIXED: Top-level useEffect to update streaming extraction only for the latest message
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1]
      if (latest.id.startsWith("temp-assistant")) {
        const update = extractFromContent(latest.content)
        streamingRef.current[latest.id] = { thinking: update.thinking, searchQueries: update.searchQueries }
      }
    }
  }, [messages]) // Watch messages array; will re-run on length/content change

  // UPDATED: Auto-expand useEffect now watches messages too; per-message, no auto-close
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1]
      if (latest.role === "assistant" && !autoExpanded[latest.id] && hasThinkingOrSearch(latest)) {
        setExpandedThinking(latest.id)
        setExpandedSearch(latest.id)
        setAutoExpanded((prev) => ({ ...prev, [latest.id]: true }))
        // REMOVED: No auto-close—buttons stay until user clicks to collapse
      }
    }
  }, [messages, autoExpanded])

  // HELPER: Check if message has thinking/search (from props or ref or content)
  const hasThinkingOrSearch = (msg: Message) => {
    const refData = streamingRef.current[msg.id]
    return (
      msg.thinking ||
      refData?.thinking ||
      extractFromContent(msg.content).thinking ||
      msg.searchQueries?.length ||
      refData?.searchQueries?.length ||
      extractFromContent(msg.content).searchQueries.length > 0
    )
  }

  // NEW: Function to extract from streaming content (now used in top-level effect)
  const extractFromContent = (content: string) => {
    const thinkingMatch = content.match(/<Thinking>([\s\S]*?)<\/Thinking>/i)
    const thinking = thinkingMatch ? thinkingMatch[1].trim() : ""
    const searchMatches = [...content.matchAll(/<search>([\s\S]*?)<\/search>/gi)]
    const searches: SearchQuery[] = []
    for (const match of searchMatches) {
      const searchText = match[1].trim()
      const lines = searchText.split("\n")
      const query = lines[0]?.replace(/^Query:|Query:\s*/i, "").trim() || ""
      const results = lines.slice(1).join("\n").trim()
      if (query) searches.push({ query, results })
    }
    return { thinking, searchQueries: searches }
  }

  // NEW: Strip tags from content for clean rendering
  const stripTagsFromContent = (content: string) => {
    return content
      .replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, "")
      .replace(/<search>[\s\S]*?<\/search>/gi, "")
      .trim()
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No messages yet. Start the conversation!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {messages.map((message, index) => {
        const isStreaming = message.id.startsWith("temp-assistant") && index === messages.length - 1
        const isThinkingExpanded = expandedThinking === message.id
        const isSearchExpanded = expandedSearch === message.id
        const hasAutoExpanded = autoExpanded[message.id]

        // FIXED: Always extract/fallback to ensure persistence post-stream
        const contentExtract = extractFromContent(message.content)
        const refData = streamingRef.current[message.id]
        const thinking = message.thinking || refData?.thinking || contentExtract.thinking || ""
        const searchQueries = message.searchQueries || refData?.searchQueries || contentExtract.searchQueries

        const displayThinking = thinking
        const displaySearches = searchQueries

        // FIXED: Ensure clean content is always a string; force String() to prevent array issues in ReactMarkdown
        const rawContent = isStreaming ? message.content : message.content
        const cleanContentForRender = stripTagsFromContent(rawContent)
        const renderContent = String(cleanContentForRender) // Coerce to string to fix children prop error

        return (
          <div key={message.id} className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[100%] rounded-lg px-4 py-3",
                message.role === "user" ? "bg-[#1E1E21] text-white/75" : "text-[16px] text-white",
              )}
            >
              {message.role === "user" ? (
                <div className="space-y-3">
                  {message.imageData && message.imageData.length > 0 && (
                    <div className="space-y-2">
                      {message.imageData.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(img.url)}
                          className="block rounded border border-white/20 hover:border-white/40 transition-colors overflow-hidden"
                        >
                          <img
                            src={img.url || "/placeholder.svg"}
                            alt="Uploaded"
                            className="max-w-xs max-h-48 object-cover hover:opacity-80 transition-opacity"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {message.uploadedFiles && message.uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {message.uploadedFiles.map((file, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedFile(file)}
                          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors text-sm w-full text-left"
                        >
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Buttons for process steps, shown before main content; persist if data exists */}
                  {displayThinking && (
                    <div className="bg-none rounded p-3">
                      <button
                        onClick={() => setExpandedThinking(isThinkingExpanded ? null : message.id)}
                        className="flex items-center gap-2 text-sm font-medium text-white/75 hover:text-white transition-colors w-full text-left"
                      >
                        {isThinkingExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span>Thinking Process</span>
                      </button>
                      {isThinkingExpanded && (
                        <div className="mt-3 text-xs text-white/60 whitespace-pre-wrap bg-[#1E1E21] rounded p-2 max-h-64 overflow-y-auto">
                          {displayThinking}
                        </div>
                      )}
                    </div>
                  )}

                  {displaySearches.length > 0 && (
                    <div className="bg-none rounded p-3">
                      <button
                        onClick={() => setExpandedSearch(isSearchExpanded ? null : message.id)}
                        className="flex items-center gap-2 text-sm font-medium text-white/75 hover:text-white transition-colors w-full text-left"
                      >
                        {isSearchExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span>Search Results ({displaySearches.length})</span>
                      </button>
                      {isSearchExpanded && (
                        <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                          {displaySearches.map((search, idx) => (
                            <div key={idx} className="text-xs bg-[#1E1E21] rounded p-2">
                              <div className="font-medium text-white/75 mb-1">Query: {search.query}</div>
                              <div className="text-white/50 whitespace-pre-wrap">
                                {search.results.split("\n").map((line, lIdx) => {
                                  const urlMatch = line.match(/$$(https?:\/\/[^$$]+)\)/)
                                  if (urlMatch) {
                                    return (
                                      <div key={lIdx}>
                                        <a
                                          href={urlMatch[1]}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-400 hover:underline"
                                        >
                                          {line.replace(urlMatch[0], "")}
                                        </a>
                                        <span>({urlMatch[1]})</span>
                                      </div>
                                    )
                                  }
                                  return <div key={lIdx}>{line}</div>
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main response, now with clean content (no tags) */}
                  <div className="prose prose-sm dark:prose-invert max-w-none text-white/75">
                    {isStreaming && !renderContent ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    ) : (
                      <ReactMarkdown
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="text-base font-bold mt-2 mb-1 text-white" {...props} />
                          ),
                          p: ({ node, ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc list-inside mb-3 space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />
                          ),
                          li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
                          em: ({ node, ...props }) => <em className="italic text-white/80" {...props} />,
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "")
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                className="rounded my-2"
                                {...props}
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            ) : (
                              <code className="bg-[#2A2A2E] px-1.5 py-0.5 rounded text-sm" {...props}>
                                {children}
                              </code>
                            )
                          },
                        }}
                      >
                        {renderContent}
                      </ReactMarkdown>
                    )}

                    {isStreaming && renderContent && (
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                    )}
                  </div>

                  {message.hasArtifact && onArtifactClick && (
                    <div className="mt-3">
                      {message.files && message.files.length > 0 && (
                        <div className="text-xs text-white/50 mb-2 space-y-1">
                          {message.files.map((file) => (
                            <div key={file.id} className="flex items-center justify-between">
                              <span className="truncate">{file.path}</span>
                              <div className="flex items-center gap-1 ml-2 whitespace-nowrap">
                                {file.additions > 0 && <span className="text-green-500">+{file.additions}</span>}
                                {file.deletions > 0 && <span className="text-red-500">-{file.deletions}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-[#1E1E21] hover:bg-[#212124e3] text-white/75 w-[26%]"
                        onClick={() => onArtifactClick(message.id)}
                      >
                        <Code2 className="w-4 h-4 mr-2" />
                        View Code Preview
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-96 bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 p-2 rounded transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <img src={selectedImage || "/placeholder.svg"} alt="Full view" className="w-full h-full object-contain" />
          </div>
        </div>
      )}

      {selectedFile && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFile(null)}
        >
          <div
            className="relative max-w-4xl max-h-96 bg-[#1E1E21] border border-[#3A3A3E] rounded-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-[#3A3A3E]">
              <p className="text-sm font-mono text-white">{selectedFile.name}</p>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-2 hover:bg-[#2A2A2E] rounded transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <pre className="p-4 text-xs text-white/75 whitespace-pre-wrap break-words">{selectedFile.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
