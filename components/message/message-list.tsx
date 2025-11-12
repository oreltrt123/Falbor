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
  const [expandedUserMessages, setExpandedUserMessages] = useState<Record<string, boolean>>({}) // Per-message user message expand state
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
                message.role === "user" ? "bg-[#222222] text-[15px] text-white/75" : "text-[15px] text-white",
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

                  {(() => {
                    const isExpanded = expandedUserMessages[message.id] ?? false;
                    const shouldTruncate = message.content.length > 200 && !isExpanded;
                    const displayContent = shouldTruncate ? message.content.slice(0, 800) + '...' : message.content;
                    const showExpandButton = message.content.length > 200 && !isExpanded;
                    const showCollapseButton = message.content.length > 200 && isExpanded;

                    if (showExpandButton) {
                      return (
                        <div className="relative">
                          <p className="text-sm whitespace-pre-wrap mb-0">{displayContent}</p>
                          <div className="absolute inset-x-0 bottom-0 h-[150px] bg-gradient-to-t from-[#222222] to-transparent pointer-events-none" />
                          <button
                            onClick={() => setExpandedUserMessages((prev) => ({ ...prev, [message.id]: true }))}
                            className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[14px] bg-transparent border-none text-white/60 hover:text-white p-0"
                          >
                            Show full message
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                          {showCollapseButton && (
                            <button
                              onClick={() => setExpandedUserMessages((prev) => ({ ...prev, [message.id]: false }))}
                              className="text-[14px] bg-transparent border-none text-white/60 hover:text-white p-0 self-start"
                            >
                              Show less
                            </button>
                          )}
                        </>
                      );
                    }
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Buttons for process steps, shown before main content; persist if data exists */}
                  {displayThinking && (
                    <div className="bg-none rounded">
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
                    <div className="bg-none rounded">
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
                        <div className="mt-3 space-y-3 max-h-64 overflow-y-auto overflow-x-hidden chat-messages-scroll">
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






// "use client"

// import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent } from "@/components/ui/card"
// import { Code2, Loader2, ChevronDown, ChevronRight, Search, Brain, FileText, X } from "lucide-react"
// import ReactMarkdown from "react-markdown"
// import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
// import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
// import { useState, useEffect, useRef, useCallback } from "react"
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// interface File {
//   id: string
//   path: string
//   additions: number
//   deletions: number
//   status: "complete" | "in-progress" | "error"
//   preview?: string
// }

// interface SearchQuery {
//   query: string
//   results: string
// }

// interface Message {
//   id: string
//   role: "user" | "assistant"
//   content: string
//   hasArtifact?: boolean
//   thinking?: string | null
//   searchQueries?: SearchQuery[] | null
//   createdAt: string
//   files?: File[]
//   imageData?: Array<{ url: string; mimeType: string }> | null
//   uploadedFiles?: Array<{ name: string; content: string; type: string }> | null
// }

// interface MessageListProps {
//   messages: Message[]
//   onArtifactClick?: (artifactId: string) => void
// }

// export function MessageList({ messages, onArtifactClick }: MessageListProps) {
//   const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({})
//   const [expandedSearch, setExpandedSearch] = useState<Record<string, boolean>>({})
//   const [selectedImage, setSelectedImage] = useState<string | null>(null)
//   const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
//   const [expandedUserMessages, setExpandedUserMessages] = useState<Record<string, boolean>>({})
//   const streamingRef = useRef<Record<string, { thinking: string; searchQueries: SearchQuery[] }>>({})
//   const lastContentRef = useRef("")

//   // Stable extract function
//   const extractFromContent = useCallback((content: string) => {
//     let thinking = ""
//     const thinkingStart = content.indexOf("<Thinking>")
//     if (thinkingStart !== -1) {
//       const afterStart = content.slice(thinkingStart + "<Thinking>".length)
//       const endIndex = afterStart.indexOf("</Thinking>")
//       thinking = endIndex !== -1 ? afterStart.slice(0, endIndex).trim() : afterStart.trim()
//     }

//     const searchMatches = [...content.matchAll(/<search>([\s\S]*?)(<\/search>|(?=<\/search>|$))/gi)]
//     const searches: SearchQuery[] = searchMatches.map(match => {
//       const searchText = match[1].trim()
//       const lines = searchText.split("\n")
//       const query = lines[0]?.replace(/^Query:|Query:\s*/i, "").trim() || ""
//       const results = lines.slice(1).join("\n").trim()
//       return { query, results }
//     }).filter(s => s.query)

//     return { thinking, searchQueries: searches }
//   }, [])

//   // Stable strip function
//   const stripTagsFromContent = useCallback((content: string) => {
//     return content
//       .replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, "")
//       .replace(/<search>[\s\S]*?<\/search>/gi, "")
//       .trim()
//   }, [])

//   // Live streaming update: Watch for content changes in last message
//   useEffect(() => {
//     if (messages.length > 0) {
//       const latest = messages[messages.length - 1]
//       if (latest.id.startsWith("temp-assistant") && latest.content !== lastContentRef.current) {
//         lastContentRef.current = latest.content
//         const update = extractFromContent(latest.content)
//         streamingRef.current[latest.id] = update
//         // Force re-check for button visibility and auto-expand
//         if (hasThinkingOrSearch(latest)) {
//           if (!expandedThinking[latest.id]) {
//             setExpandedThinking(prev => ({ ...prev, [latest.id]: true }))
//             setExpandedSearch(prev => ({ ...prev, [latest.id]: true }))
//           }
//         }
//       }
//     }
//   }, [messages[messages.length - 1]?.content, extractFromContent]) // Direct dep on last content for live deltas

//   const hasThinkingOrSearch = useCallback((msg: Message) => {
//     const refData = streamingRef.current[msg.id]
//     const extract = extractFromContent(msg.content)
//     const hasPartialThinking = msg.content.includes("<Thinking>")
//     const hasPartialSearch = msg.content.includes("<search>")
//     return (
//       msg.thinking ||
//       refData?.thinking ||
//       extract.thinking ||
//       hasPartialThinking ||
//       (msg.searchQueries?.length || refData?.searchQueries?.length || extract.searchQueries.length) > 0 ||
//       hasPartialSearch
//     )
//   }, [extractFromContent])

//   if (messages.length === 0) {
//     return (
//       <div className="flex items-center justify-center h-full text-muted-foreground" role="status" aria-live="polite">
//         <p>No messages yet. Start the conversation!</p>
//       </div>
//     )
//   }

//   return (
//     <div className="space-y-6" role="log" aria-live="polite">
//       {messages.map((message, index) => {  // Added index for stable key if needed
//         const isStreaming = message.id.startsWith("temp-assistant") && index === messages.length - 1
//         const extract = extractFromContent(message.content)
//         const refData = streamingRef.current[message.id]
//         const thinking = message.thinking || refData?.thinking || extract.thinking || ""
//         const searchQueries = message.searchQueries || refData?.searchQueries || extract.searchQueries
//         const cleanContent = stripTagsFromContent(message.content)
//         const renderContent = String(cleanContent)

//         return (
//           <div key={`${message.id}-${index}`} className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
//             <div
//               className={cn(
//                 "max-w-[100%] rounded-lg px-4 py-3",
//                 message.role === "user" ? "bg-[#222222] text-[15px] text-white/75" : "text-[15px] text-white",
//               )}
//               role={message.role === "user" ? "user-message" : "assistant-message"}
//               aria-label={`${message.role} message`}
//             >
//               {message.role === "user" ? (
//                 <div className="space-y-3">
//                   {message.imageData?.map((img, idx) => (
//                     <button
//                       key={idx}
//                       onClick={() => setSelectedImage(img.url)}
//                       className="block rounded border border-white/20 hover:border-white/40 transition-colors overflow-hidden"
//                       aria-label={`View image ${idx + 1}`}
//                     >
//                       <img
//                         src={img.url || "/placeholder.svg?height=200&width=300"}
//                         alt={`Uploaded image ${idx + 1}`}
//                         className="max-w-xs max-h-48 object-cover hover:opacity-80 transition-opacity"
//                       />
//                     </button>
//                   ))}
//                   {message.uploadedFiles?.map((file, idx) => (
//                     <button
//                       key={idx}
//                       onClick={() => setSelectedFile(file)}
//                       className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors text-sm w-full text-left"
//                       aria-label={`View file ${file.name}`}
//                     >
//                       <FileText className="w-4 h-4 flex-shrink-0" />
//                       <span className="truncate">{file.name}</span>
//                     </button>
//                   ))}
//                   <UserMessageContent
//                     content={message.content}
//                     id={message.id}
//                     expandedUserMessages={expandedUserMessages}
//                     setExpandedUserMessages={setExpandedUserMessages}
//                   />
//                 </div>
//               ) : (
//                 <div className="space-y-3">
//                   {hasThinkingOrSearch(message) && (
//                     <Collapsible
//                       open={expandedThinking[message.id] ?? false}
//                       onOpenChange={(open) => setExpandedThinking(prev => ({ ...prev, [message.id]: open }))}
//                       className="w-full"
//                     >
//                       <CollapsibleTrigger asChild>
//                         <Button
//                           variant="ghost"
//                           size="sm"
//                           className="relative flex items-center gap-2 justify-start w-full text-left text-sm font-medium text-white/75 hover:text-white bg-transparent hover:bg-transparent border-none p-0 h-auto group"
//                           aria-expanded={expandedThinking[message.id]}
//                           aria-controls={`thinking-${message.id}`}
//                         >
//                           <div className="relative w-4 h-4">
//                             <Brain
//                               className={cn(
//                                 "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
//                                 "opacity-100 translate-y-0",
//                                 (expandedThinking[message.id] ? "opacity-0 -translate-y-1" : ""),
//                                 "group-hover:opacity-0 group-hover:-translate-y-1"
//                               )}
//                               aria-hidden="true"
//                             />
//                             <ChevronDown
//                               className={cn(
//                                 "absolute inset-0 w-4 h-4 transition-all duration-200 ease-in-out",
//                                 "opacity-0 translate-y-1",
//                                 (expandedThinking[message.id] ? "opacity-100 translate-y-0" : ""),
//                                 "group-hover:opacity-100 group-hover:translate-y-0",
//                                 expandedThinking[message.id] && "rotate-180"
//                               )}
//                               aria-hidden="true"
//                             />
//                           </div>
//                           <span>
//                             Thought{" "}
//                             {thinking ? "✓" : searchQueries.length > 0 ? searchQueries.length : 0}
//                           </span>
//                         </Button>
//                       </CollapsibleTrigger>
//                       <CollapsibleContent className="mt-2 space-y-3">
//                         {thinking && (
//                           <Card className="bg-[#1E1E21] border-white/10">
//                             <CardContent className="p-3 text-xs text-white/60 whitespace-pre-wrap max-h-64 overflow-y-auto">
//                               {thinking}
//                             </CardContent>
//                           </Card>
//                         )}
//                         {searchQueries.length > 0 && (
//                           <div className="space-y-2">
//                             {searchQueries.map((search, idx) => (
//                               <Card key={idx} className="bg-[#1E1E21] border-none">
//                                 <CardContent className="">
//                                   {/* <div className="font-medium text-white/75 mb-1">{search.query}</div> */}
//                                   <div className="text-white/50 text-xs whitespace-pre-wrap">
//                                     {search.results.split("\n").map((line, lIdx) => {
//                                       const urlMatch = line.match(/\[(https?:\/\/[^[\]]+)\]/)
//                                       if (urlMatch) {
//                                         return (
//                                           <div key={lIdx}>
//                                             <a
//                                               href={urlMatch[1]}
//                                               target="_blank"
//                                               rel="noopener noreferrer"
//                                               className="text-primary hover:underline"
//                                             >
//                                               {line.replace(urlMatch[0], "")}
//                                             </a>
//                                           </div>
//                                         )
//                                       }
//                                       return <div key={lIdx}>{line}</div>
//                                     })}
//                                   </div>
//                                 </CardContent>
//                               </Card>
//                             ))}
//                           </div>
//                         )}
//                       </CollapsibleContent>
//                     </Collapsible>
//                   )}

//                   <div className="prose prose-sm dark:prose-invert max-w-none text-white/75">
//                     {isStreaming && !renderContent ? (
//                       <div className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
//                         <Loader2 className="w-4 h-4 animate-spin" />
//                         <span className="text-sm">Generating response...</span>
//                       </div>
//                     ) : (
//                       <ReactMarkdown
//                         components={{
//                           h1: ({ ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />,
//                           h2: ({ ...props }) => <h2 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />,
//                           h3: ({ ...props }) => <h3 className="text-base font-bold mt-2 mb-1 text-white" {...props} />,
//                           p: ({ ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
//                           ul: ({ ...props }) => <ul className="list-disc list-inside mb-3 space-y-1" {...props} />,
//                           ol: ({ ...props }) => <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />,
//                           li: ({ ...props }) => <li className="ml-2" {...props} />,
//                           strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
//                           em: ({ ...props }) => <em className="italic text-white/80" {...props} />,
//                           code({ inline, className, children, ...props }) {
//                             const match = /language-(\w+)/.exec(className || "")
//                             return !inline && match ? (
//                               <SyntaxHighlighter
//                                 style={oneDark}
//                                 language={match[1]}
//                                 PreTag="div"
//                                 className="rounded my-2 text-xs"
//                                 {...props}
//                               >
//                                 {String(children).replace(/\n$/, "")}
//                               </SyntaxHighlighter>
//                             ) : (
//                               <code className="bg-[#222222] px-1.5 py-1 rounded-md text-sm" {...props}>
//                                 {children}
//                               </code>
//                             )
//                           },
//                         }}
//                       >
//                         {renderContent}
//                       </ReactMarkdown>
//                     )}
//                     {isStreaming && renderContent && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />}
//                   </div>

//                   {message.hasArtifact && message.files && message.files.length > 0 && (
//                     <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
//                       {message.files.map((file) => (
//                         <Card key={file.id} className="relative overflow-hidden bg-muted/50 border-white/10 h-32 flex flex-col">
//                           <CardContent className="flex-1 p-2 flex flex-col justify-between">
//                             <div className="flex items-center justify-between">
//                               <span className="text-xs font-mono truncate text-white/75">{file.path}</span>
//                               <span
//                                 className={cn(
//                                   "w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold",
//                                   file.status === "complete" ? "bg-green-500 text-white" :
//                                   file.status === "error" ? "bg-red-500 text-white" :
//                                   "bg-yellow-500 text-black"
//                                 )}
//                                 aria-label={file.status}
//                               >
//                                 {file.status === "complete" ? "✓" : file.status === "error" ? "✗" : "…"}
//                               </span>
//                             </div>
//                             <div className="text-xs text-white/50">
//                               <span className={cn("mr-1", file.additions > 0 && "text-green-500")}>+{file.additions}</span>
//                               <span className={cn("mr-1", file.deletions > 0 && "text-red-500")}>-{file.deletions}</span>
//                             </div>
//                             {file.preview && (
//                               <div className="mt-1 h-16 bg-black/20 rounded overflow-hidden">
//                                 <img src={file.preview} alt={`Preview of ${file.path}`} className="w-full h-full object-cover" />
//                               </div>
//                             )}
//                           </CardContent>
//                         </Card>
//                       ))}
//                       {onArtifactClick && (
//                         <Button
//                           variant="outline"
//                           size="sm"
//                           className="col-span-full bg-transparent hover:bg-accent text-white/75 border-white/20"
//                           onClick={() => onArtifactClick(message.id)}
//                           aria-label="Open full code review"
//                         >
//                           <Code2 className="w-4 h-4 mr-2" />
//                           Open Code Review
//                         </Button>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>
//           </div>
//         )
//       })}

//       {/* Image/File Modals */}
//       {selectedImage && (
//         <div
//           className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
//           onClick={() => setSelectedImage(null)}
//           role="dialog"
//           aria-label="Image viewer"
//         >
//           <div className="relative max-w-4xl max-h-full bg-black rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
//             <button
//               onClick={() => setSelectedImage(null)}
//               className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 p-2 rounded transition-colors"
//               aria-label="Close image"
//             >
//               <X className="w-4 h-4 text-white" />
//             </button>
//             <img src={selectedImage} alt="Full view" className="w-full h-auto max-h-full object-contain" />
//           </div>
//         </div>
//       )}

//       {selectedFile && (
//         <div
//           className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
//           onClick={() => setSelectedFile(null)}
//           role="dialog"
//           aria-label={`File viewer: ${selectedFile.name}`}
//         >
//           <div
//             className="relative max-w-4xl max-h-full bg-[#1E1E21] border border-[#3A3A3E] rounded-lg overflow-hidden flex flex-col w-full max-w-2xl"
//             onClick={e => e.stopPropagation()}
//           >
//             <div className="flex items-center justify-between p-3 border-b border-[#3A3A3E]">
//               <p className="text-sm font-mono text-white truncate">{selectedFile.name}</p>
//               <button
//                 onClick={() => setSelectedFile(null)}
//                 className="p-2 hover:bg-[#2A2A2E] rounded transition-colors"
//                 aria-label="Close file"
//               >
//                 <X className="w-4 h-4 text-white" />
//               </button>
//             </div>
//             <div className="flex-1 overflow-y-auto p-4">
//               <pre className="text-xs text-white/75 whitespace-pre-wrap break-words font-mono">{selectedFile.content}</pre>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

// function UserMessageContent({
//   content,
//   id,
//   expandedUserMessages,
//   setExpandedUserMessages,
// }: {
//   content: string
//   id: string
//   expandedUserMessages: Record<string, boolean>
//   setExpandedUserMessages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
// }) {
//   const isExpanded = expandedUserMessages[id] ?? false
//   const shouldTruncate = content.length > 800 && !isExpanded
//   const displayContent = shouldTruncate ? content.slice(0, 800) + "..." : content

//   return (
//     <div className="relative">
//       <p className="text-sm whitespace-pre-wrap mb-0 leading-relaxed" aria-label={displayContent}>
//         {displayContent}
//       </p>
//       {shouldTruncate && !isExpanded && (
//         <>
//           <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#222222] to-transparent pointer-events-none" />
//           <Button
//             variant="ghost"
//             size="sm"
//             className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs bg-transparent hover:bg-transparent border-none p-0 text-white/60 hover:text-white"
//             onClick={() => setExpandedUserMessages(prev => ({ ...prev, [id]: true }))}
//             aria-expanded={false}
//             aria-label="Expand full message"
//           >
//             Show full message
//           </Button>
//         </>
//       )}
//       {isExpanded && content.length > 800 && (
//         <Button
//           variant="ghost"
//           size="sm"
//           className="mt-2 text-xs bg-transparent hover:bg-transparent border-none p-0 text-white/60 hover:text-white self-start"
//           onClick={() => setExpandedUserMessages(prev => ({ ...prev, [id]: false }))}
//           aria-expanded={true}
//           aria-label="Collapse message"
//         >
//           Show less
//         </Button>
//       )}
//     </div>
//   )
// }