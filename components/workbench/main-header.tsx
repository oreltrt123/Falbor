// components/workbench/main-header.tsx
import { Globe, Code2, Download } from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface MainHeaderProps {
  previewUrl: string | null
  showDownloadMenu: boolean
  setShowDownloadMenu: (open: boolean) => void
  handleDownload: () => void
}

export function MainHeader({ previewUrl, showDownloadMenu, setShowDownloadMenu, handleDownload }: MainHeaderProps) {
  return (
    <div className="p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <TabsList className="w-[100%] justify-start">
          <TabsTrigger value="preview" className="gap-2">
            <Globe className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="code" className="gap-2">
            <Code2 className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="relative flex items-center gap-2">
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
          >
            <img width={13} height={13} className="mr-1" src="/window.png" alt="" />
            {previewUrl}
          </a>
        )}
        <button
          id="download-button"
          onClick={(e) => {
            e.stopPropagation()
            setShowDownloadMenu(!showDownloadMenu)
          }}
          className="flex items-center gap-1 text-xs text-blue-500 hover:underline p-1 rounded"
        >
          <Download className="w-4 h-4" />
        </button>
        {showDownloadMenu && (
          <div className="absolute right-0 top-full mt-1 bg-[#1b1b1b] border border-[#4444442d] rounded p-3 w-48 z-10 shadow-lg">
            <p className="text-xs text-white/80 mb-2">Download all project files as ZIP</p>
            <button
              onClick={handleDownload}
              className="w-full bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700 transition-colors"
            >
              Download ZIP
            </button>
          </div>
        )}
      </div>
    </div>
  )
}