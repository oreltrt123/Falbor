"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Sparkles, Loader2, ArrowLeft, Lightbulb, Loader } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TaskCreateFormProps {
  projectId: string
  projectInfo: { title: string; description?: string } | null
  onBack: () => void
  onTaskCreated: () => void
}

export function TaskCreateForm({ projectId, projectInfo, onBack, onTaskCreated }: TaskCreateFormProps) {
  const [newTask, setNewTask] = useState({ title: "", description: "" })
  const [aiLoading, setAiLoading] = useState(false)
  const { toast } = useToast()

  const [isActiveTitle, setIsActiveTitle] = useState(false)
  const [isFocusedTitle, setIsFocusedTitle] = useState(false)
  const [isActiveDesc, setIsActiveDesc] = useState(false)
  const [isFocusedDesc, setIsFocusedDesc] = useState(false)

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.description.trim()) {
      toast({ title: "Error", description: "Title and description are required", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...newTask }),
      })

      if (res.ok) {
        toast({ title: "Success", description: "Task created successfully" })
        setNewTask({ title: "", description: "" })
        onTaskCreated()
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to create task", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" })
    }
  }

  const handleImproveTask = async () => {
    if (!newTask.description.trim()) {
      toast({ title: "Error", description: "Please enter a description first", variant: "destructive" })
      return
    }

    setAiLoading(true)
    try {
      const res = await fetch("/api/tasks/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newTask.description }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewTask((prev) => ({ ...prev, description: data.improved }))
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

  const handleGenerateIdea = async () => {
    setAiLoading(true)
    try {
      const res = await fetch("/api/tasks/generate-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewTask({ title: data.title, description: data.description })
        toast({ title: "Success", description: "Task idea generated! 1 credit used" })
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to generate idea", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate idea", variant: "destructive" })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Tasks
      </Button>

      <h2 className="text-2xl font-bold mb-6">Create New Task</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Task Title</label>
          <Input
            value={newTask.title}
            onChange={(e) => {
              setNewTask((prev) => ({ ...prev, title: e.target.value }))
              if (e.target.value.trim().length > 0) {
                setIsActiveTitle(true)
              }
            }}
            onFocus={() => {
              setIsFocusedTitle(true)
              if (newTask.title.trim().length > 0) {
                setIsActiveTitle(true)
              }
            }}
            onBlur={() => {
              setIsFocusedTitle(false)
              if (newTask.title.trim().length === 0) {
                setIsActiveTitle(false)
              }
            }}
            placeholder="Enter task title..."
            className="w-full"
            isActive={isActiveTitle}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Task Description</label>
          <div className="relative">
            <Textarea
              value={newTask.description}
              onChange={(e) => {
                setNewTask((prev) => ({ ...prev, description: e.target.value }))
                if (e.target.value.trim().length > 0) {
                  setIsActiveDesc(true)
                }
              }}
              onFocus={() => {
                setIsFocusedDesc(true)
                if (newTask.description.trim().length > 0) {
                  setIsActiveDesc(true)
                }
              }}
              onBlur={() => {
                setIsFocusedDesc(false)
                if (newTask.description.trim().length === 0) {
                  setIsActiveDesc(false)
                }
              }}
              placeholder="Describe what you want to accomplish..."
              className="w-full min-h-[200px] max-h-[200px] pb-12"
              isActive={isActiveDesc}
            />
            <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between p-2 bg-[#e4e4e4a8] rounded-sm">
              <Button
                size="sm"
                variant="outline"
                onClick={handleImproveTask}
                disabled={aiLoading || !newTask.description.trim()}
                className="bg-white shadow-none border-none cursor-pointer h-7"
              >
                {aiLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Improve 1 credit
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Improve 1 credit
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateIdea}
                disabled={aiLoading}
                className="bg-white absolute left-41 shadow-none border-none cursor-pointer h-7"
              >
                {aiLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generate Idea 1 credit
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4 mr-1" />
                    Generate Idea 1 credit
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleCreateTask} className="flex-1">
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        </div>
          <p className="text-[11px] text-muted-foreground mt-[-12px]">
            {projectInfo && (
              <>
                AI generates ideas based on your website files <strong>{projectInfo.title}</strong>
              </>
            )}
          </p>
      </div>
    </div>
  )
}