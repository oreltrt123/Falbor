// components/workbench/search-sidebar.tsx
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SearchResult {
  path: string
  line: number
  content: string
  matches: { start: number; end: number }[]
}

interface SearchSidebarProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: SearchResult[]
  isSearching: boolean
  highlightMatch: (text: string, matches: { start: number; end: number }[]) => any
  onResultClick: (path: string) => void
  files: Array<{ path: string; content: string; language: string }>
}

export function SearchSidebar({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  highlightMatch,
  onResultClick,
  files,
}: SearchSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files and code..."
          className="h-[30px] p-2 w-full bg-[#1a1a1a] border border-[#4444442d] rounded-md text-white text-sm focus:border-[#5555976c] focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto chat-messages-scroll">
        {isSearching ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-white/50" />
          </div>
        ) : searchResults.length > 0 ? (
          <div className="p-2">
            <p className="text-xs text-white/50 mb-2">{searchResults.length} results</p>
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                onClick={() => {
                  const file = files.find((f) => f.path === result.path)
                  if (file) onResultClick(result.path)
                }}
                className="mb-3 p-2 hover:bg-[#3b3b3f] cursor-pointer rounded text-xs"
              >
                <div className="text-blue-400 font-mono mb-1">{result.path}</div>
                <div className="text-white/60 mb-1">Line {result.line}</div>
                <pre className="text-white/80 overflow-x-auto whitespace-pre-wrap break-words">
                  {highlightMatch(result.content, result.matches)}
                </pre>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="p-4 text-center text-white/50 text-sm">No results found</div>
        ) : (
          <div className="p-4 text-center text-white/50 text-sm">Start typing to search</div>
        )}
      </div>
    </div>
  )
}