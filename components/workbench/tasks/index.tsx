"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTaskAutomation } from "@/hooks/use-task-automation"
import { TaskCreateForm } from "./task-create-form"
import { TaskEditModal } from "./task-edit-modal"
import { TaskItem } from "./task-item"
import { AutomationControls } from "./automation-controls"
import { ErrorModal } from "./error-modal"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Task {
  id: string
  title: string
  description: string
  status: "pending" | "completed" | "error"
  orderIndex: number
  errorMessage?: string
  createdAt: string
}

interface TasksSectionProps {
  projectId: string
  onMessageSent?: () => void
}

export function TasksSection({ projectId, onMessageSent }: TasksSectionProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [automation, setAutomation] = useState({ isActive: false, intervalMinutes: 10 })
  const [errorModal, setErrorModal] = useState<{ taskId: string; error: string } | null>(null)
  const [projectInfo, setProjectInfo] = useState<{ title: string; description?: string } | null>(null)
  const { toast } = useToast()

  useTaskAutomation(projectId, automation.isActive, automation.intervalMinutes, () => {
    fetchTasks()
    onMessageSent?.()
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    fetchTasks()
    fetchAutomation()
    fetchProjectInfo()
  }, [projectId])

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (automation.isActive) {
      interval = setInterval(() => {
        fetchTasks();
        onMessageSent?.();
      }, 5000); // Poll every 5 seconds for live updates when automation is active
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [automation.isActive, onMessageSent, projectId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (tasks.some((t) => t.status === "pending")) {
      interval = setInterval(() => {
        fetchTasks();
        onMessageSent?.();
      }, 5000); // Poll every 5 seconds if there are pending tasks
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [tasks, onMessageSent, projectId]);

  const fetchProjectInfo = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setProjectInfo({ title: data.title, description: data.description })
      }
    } catch (error) {
      console.error("Failed to fetch project info:", error)
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAutomation = async () => {
    try {
      const res = await fetch(`/api/tasks/automation?projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setAutomation(data)
      }
    } catch (error) {
      console.error("Failed to fetch automation:", error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Success", description: "Task deleted" })
        fetchTasks()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" })
    }
  }

  const handleSendToAI = async (task: Task) => {
    try {
      const res = await fetch("/api/tasks/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, taskId: task.id, message: `${task.title}\n\n${task.description}` }),
      })

      if (res.ok) {
        toast({ title: "Success", description: "Task sent to AI" })
        fetchTasks()
        onMessageSent?.()
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to send task", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send task", variant: "destructive" })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === over.id)

    const reorderedTasks = arrayMove(tasks, oldIndex, newIndex)
    setTasks(reorderedTasks)

    try {
      await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: active.id,
          newIndex,
        }),
      })
    } catch (error) {
      toast({ title: "Error", description: "Failed to reorder task", variant: "destructive" })
      fetchTasks()
    }
  }

  const handleToggleAutomation = async () => {
    try {
      const res = await fetch("/api/tasks/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          isActive: !automation.isActive,
          intervalMinutes: automation.intervalMinutes,
        }),
      })

      if (res.ok) {
        setAutomation((prev) => ({ ...prev, isActive: !prev.isActive }))
        toast({ title: "Success", description: automation.isActive ? "Automation stopped" : "Automation started" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to toggle automation", variant: "destructive" })
    }
  }

  const handleUpdateInterval = async (minutes: number) => {
    try {
      const res = await fetch("/api/tasks/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, isActive: automation.isActive, intervalMinutes: minutes }),
      })

      if (res.ok) {
        setAutomation((prev) => ({ ...prev, intervalMinutes: minutes }))
        toast({ title: "Success", description: "Interval updated" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update interval", variant: "destructive" })
    }
  }

  const handleFixError = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    try {
      const res = await fetch("/api/tasks/fix-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, taskId, error: task.errorMessage }),
      })

      if (res.ok) {
        toast({ title: "Success", description: "Fix request sent to AI" })
        setErrorModal(null)
        fetchTasks()
        onMessageSent?.()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send fix request", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (isCreating) {
    return (
      <TaskCreateForm
        projectId={projectId}
        projectInfo={projectInfo}
        onBack={() => setIsCreating(false)}
        onTaskCreated={() => {
          setIsCreating(false)
          fetchTasks()
        }}
      />
    )
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Automations <Badge className="" variant="secondary">Beta</Badge></h2>
          <p className="text-sm text-muted-foreground">Manage and automate your project tasks</p>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      <AutomationControls
        automation={automation}
        onToggle={handleToggleAutomation}
        onUpdateInterval={handleUpdateInterval}
        disabled={tasks.length === 0}
      />

      {tasks.length === 0 ? (
        <Card className="p-12 text-center shadow-none">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-6 h-6 text-black" />
            </div>
            <div>
              <h3 className="text-lg font-semibold ">No tasks yet</h3>
              <p className="text-sm text-muted-foreground mb-3">Create a task or generate an idea, refine it, and submit for a polished result.</p>
              <Button onClick={() => setIsCreating(true)} className="mx-auto flex items-center justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onSend={handleSendToAI}
                  onEdit={setEditingTask}
                  onDelete={handleDeleteTask}
                  onViewError={(taskId, error) => setErrorModal({ taskId, error })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editingTask && (
        <TaskEditModal task={editingTask} onClose={() => setEditingTask(null)} onTaskUpdated={fetchTasks} />
      )}

      {errorModal && (
        <ErrorModal
          error={errorModal.error}
          onClose={() => setErrorModal(null)}
          onFix={() => handleFixError(errorModal.taskId)}
        />
      )}
    </div>
  )
}