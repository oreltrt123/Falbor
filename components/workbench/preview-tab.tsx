// components/workbench/preview-tab.tsx
import { Loader2 } from "lucide-react"
import { TabsContent } from "@/components/ui/tabs"

interface PreviewTabProps {
  loading: boolean
  previewUrl: string | null
}

export function PreviewTab({ loading, previewUrl }: PreviewTabProps) {
  return (
    <TabsContent value="preview" className="flex-1 m-0">
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Setting up preview...</span>
        </div>
      ) : previewUrl ? (
        <iframe src={previewUrl} className="w-full h-full border-0" title="Live Preview" />
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Failed to load preview
        </div>
      )}
    </TabsContent>
  )
}