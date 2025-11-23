import { Loader } from "lucide-react"
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
          <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
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