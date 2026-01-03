"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Trash2, Edit, Send, AlertCircle, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface Task {
  id: string
  title: string
  description: string
  status: "pending" | "completed" | "error"
  orderIndex: number
  errorMessage?: string
  createdAt: string
}

interface TaskItemProps {
  task: Task
  onSend: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onViewError: (taskId: string, error: string) => void
}

export function TaskItem({ task, onSend, onEdit, onDelete, onViewError }: TaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <Card
        className={cn(
          "p-4 transition-all shadow-none",
          task.status === "error" && "border-red-300 bg-red-50",
          task.status === "completed" && "border-white bg-[#e4e4e4a8]",
        )}
      >
        <div className="flex items-start gap-4">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pt-1">
            <GripVertical className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1 truncate">{task.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {task.description.length > 100 ? `${task.description.substring(0, 100)}...` : task.description}
            </p>
            {task.status === "error" && (
              <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Error occurred</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onViewError(task.id, task.errorMessage || "Unknown error")}
                >
                  View & Fix
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="shadow-none border-none" onClick={() => onSend(task)} title="Send to AI">
              <Send className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" className="shadow-none border-none" onClick={() => onEdit(task)} title="Edit task">
              <Edit className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="destructive" className="shadow-none border-none" onClick={() => onDelete(task.id)} title="Delete task">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
