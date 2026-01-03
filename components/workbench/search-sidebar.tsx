// components/workbench/search-sidebar.tsx
import { Loader, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

type ProjectFile = {
  path: string
  content: string
}

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
  files: ProjectFile[]
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
        />
      </div>

      <div className="flex-1 overflow-y-auto chat-messages-scroll">
        {isSearching ? (
          <div className="flex items-center justify-center p-4">
            <Loader className="w-5 h-5 animate-spin text-black/50" />
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
                className="p-2 hover:bg-[#e4e4e4] cursor-pointer rounded text-xs"
              >
                <div className="text-gray-400 font-mono mb-1">{result.path}</div>
                <div className="text-black/60 mb-1">Line {result.line}</div>
                <pre className="text-black/80 overflow-x-auto whitespace-pre-wrap break-words">
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