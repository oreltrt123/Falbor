// components/workbench/main-header.tsx
import { Globe, Code2, Download, ExternalLink } from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface MainHeaderProps {
  previewUrl: string | null
  showDownloadMenu: boolean
  setShowDownloadMenu: (open: boolean) => void
  handleDownload: () => void
}

export function MainHeader({
  previewUrl,
  showDownloadMenu,
  setShowDownloadMenu,
  handleDownload
}: MainHeaderProps) {
  return (
    <div className="p-3 flex items-center justify-between">
      {/* Left side */}
      <div className="flex items-center gap-2">
        <TabsList className="w-[100%] justify-start">
          <TabsTrigger value="preview" className="gap-2">
            <Globe className="w-4 h-4 text-black" />
          </TabsTrigger>
          <TabsTrigger value="code" className="gap-2">
            <Code2 className="w-4 h-4 text-black" />
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Center preview URL */}
      <div className="flex-1 flex justify-center">
        {previewUrl && (
          <div className="flex items-center gap-1 bg-[#e4e4e4b4] px-2 py-1 rounded-sm text-black/80 text-[13px] max-w-[60%] truncate">
            <span className="truncate">{previewUrl}</span>

            {/* Button that opens the URL in a new page */}
            <button
              onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
              className="ml-1 p-1 hover:bg-black/10 rounded transition"
            >
              <img width={13} height={13} src="/icons/new-tab.png" alt="" />
            </button>
          </div>
        )}
      </div>

      {/* Right side download menu */}
      <div className="relative flex items-center gap-2">
        <button
          id="download-button"
          onClick={(e) => {
            e.stopPropagation()
            setShowDownloadMenu(!showDownloadMenu)
          }}
          className="flex items-center gap-1 text-xs text-black/80 hover:underline p-1 rounded"
        >
          <Download className="w-4 h-4" />
        </button>

        {showDownloadMenu && (
          <div className="absolute right-0 top-full mt-1 bg-[#f1efef] border border-[#44444413] rounded p-1 w-48 z-10">
            <button
              onClick={handleDownload}
              className="w-full bg-[#0099FF] text-white text-xs py-1 px-2 rounded hover:bg-[#0099FF] transition-colors"
            >
              Download ZIP
            </button>
            <p className="text-xs text-black/80 mt-1 text-center">
              Download project ZIP
            </p>
          </div>
        )}
      </div>
    </div>
  )
}





// // components/workbench/main-header.tsx
// import { Globe, Code2, Download, ExternalLink, Terminal } from "lucide-react"
// import { TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { cn } from "@/lib/utils"

// interface MainHeaderProps {
//   previewUrl: string | null
//   showDownloadMenu: boolean
//   setShowDownloadMenu: (open: boolean) => void
//   handleDownload: () => void
//   toggleTerminal: () => void
// }

// export function MainHeader({
//   previewUrl,
//   showDownloadMenu,
//   setShowDownloadMenu,
//   handleDownload,
//   toggleTerminal
// }: MainHeaderProps) {
//   return (
//     <div className="p-3 flex items-center justify-between">
//       {/* Left side */}
//       <div className="flex items-center gap-2">
//         <TabsList className="w-[100%] justify-start">
//           <TabsTrigger value="preview" className="gap-2">
//             <Globe className="w-4 h-4 text-black" />
//           </TabsTrigger>
//           <TabsTrigger value="code" className="gap-2">
//             <Code2 className="w-4 h-4 text-black" />
//           </TabsTrigger>
//           <TabsTrigger value="terminal" className="gap-2" onClick={(e) => {
//             e.preventDefault()
//             toggleTerminal()
//           }}>
//             <Terminal className="w-4 h-4 text-black" />
//           </TabsTrigger>
//         </TabsList>
//       </div>

//       {/* Center preview URL */}
//       <div className="flex-1 flex justify-center">
//         {previewUrl && (
//           <div className="flex items-center gap-1 bg-[#e4e4e4b4] px-2 py-1 rounded-sm text-black/80 text-[13px] max-w-[60%] truncate">
//             <span className="truncate">{previewUrl}</span>

//             {/* Button that opens the URL in a new page */}
//             <button
//               onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
//               className="ml-1 p-1 hover:bg-black/10 rounded transition"
//             >
//               <img width={13} height={13} src="/icons/new-tab.png" alt="" />
//             </button>
//           </div>
//         )}
//       </div>

//       {/* Right side download menu */}
//       <div className="relative flex items-center gap-2">
//         <button
//           id="download-button"
//           onClick={(e) => {
//             e.stopPropagation()
//             setShowDownloadMenu(!showDownloadMenu)
//           }}
//           className="flex items-center gap-1 text-xs text-black/80 hover:underline p-1 rounded"
//         >
//           <Download className="w-4 h-4" />
//         </button>

//         {showDownloadMenu && (
//           <div className="absolute right-0 top-full mt-1 bg-[#f1efef] border border-[#44444413] rounded p-1 w-48 z-10">
//             <button
//               onClick={handleDownload}
//               className="w-full bg-[#0099FF] text-white text-xs py-1 px-2 rounded hover:bg-[#0099FF] transition-colors"
//             >
//               Download ZIP
//             </button>
//             <p className="text-xs text-black/80 mt-1 text-center">
//               Download project ZIP
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }