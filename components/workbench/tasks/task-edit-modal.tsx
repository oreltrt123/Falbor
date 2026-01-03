"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { X, Save, Sparkles, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Task {
  id: string
  title: string
  description: string
  status: "pending" | "completed" | "error"
  orderIndex: number
  errorMessage?: string
  createdAt: string
}

interface TaskEditModalProps {
  task: Task
  onClose: () => void
  onTaskUpdated: () => void
}

export function TaskEditModal({ task, onClose, onTaskUpdated }: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [aiLoading, setAiLoading] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Error", description: "Title and description are required", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, title, description }),
      })

      if (res.ok) {
        toast({ title: "Success", description: "Task updated successfully" })
        onTaskUpdated()
        onClose()
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to update task", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" })
    }
  }

  const handleImproveTask = async () => {
    if (!description.trim()) {
      toast({ title: "Error", description: "Please enter a description first", variant: "destructive" })
      return
    }

    setAiLoading(true)
    try {
      const res = await fetch("/api/tasks/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })

      if (res.ok) {
        const data = await res.json()
        setDescription(data.improved)
        toast({ title: "Success", description: "Task improved! 1 credit used" })
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to improve task", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to improve task", variant: "destructive" })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-white p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Edit Task</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Task Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter task title..." />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Task Description</label>
            <div className="relative">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want to accomplish..."
                className="w-full min-h-[200px]"
              />
              <div className="absolute top-2 right-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleImproveTask}
                  disabled={aiLoading || !description.trim()}
                  className="bg-white"
                >
                  {aiLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      Improve (1 credit)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
