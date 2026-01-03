"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, Sparkles } from "lucide-react"

interface ErrorModalProps {
  error: string
  onClose: () => void
  onFix: () => void
}

export function ErrorModal({ error, onClose, onFix }: ErrorModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-white p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold mb-2">Task Error</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{error}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onFix}>
            <Sparkles className="w-4 h-4 mr-2" />
            Fix with AI
          </Button>
        </div>
      </Card>
    </div>
  )
}
