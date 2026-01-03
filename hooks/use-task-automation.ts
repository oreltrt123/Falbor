"use client"

import { useEffect, useCallback } from "react"

export function useTaskAutomation(
  projectId: string,
  isActive: boolean,
  intervalMinutes: number,
  onTaskSent?: () => void,
) {
  const checkAndRunTask = useCallback(async () => {
    if (!isActive) return

    try {
      const res = await fetch("/api/tasks/automation/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.taskId) {
          console.log(`[Automation] Sent task: ${data.taskTitle}`)
          onTaskSent?.()
        }
      }
    } catch (error) {
      console.error("[Automation] Failed to check task:", error)
    }
  }, [projectId, isActive, onTaskSent])

  useEffect(() => {
    if (!isActive) return

    // Run immediately on activation
    checkAndRunTask()

    // Then run on interval
    const intervalMs = intervalMinutes * 60 * 1000
    const interval = setInterval(checkAndRunTask, intervalMs)

    return () => clearInterval(interval)
  }, [isActive, intervalMinutes, checkAndRunTask])
}
