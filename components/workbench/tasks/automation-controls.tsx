"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Power, Clock } from "lucide-react"

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

interface AutomationControlsProps {
  automation: { isActive: boolean; intervalMinutes: number }
  onToggle: () => void
  onUpdateInterval: (minutes: number) => void
  disabled: boolean
}

export function AutomationControls({
  automation,
  onToggle,
  onUpdateInterval,
  disabled,
}: AutomationControlsProps) {
  return (
    <Card className="p-4 mb-6 bg-gradient-to-r shadow-none from-white to-[#e7e7e7] border-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant={automation.isActive ? "destructive" : "default"}
            onClick={onToggle}
            disabled={disabled}
          >
            <Power className="w-4 h-4 mr-2" />
            {automation.isActive ? "Stop Automation" : "Start Automation"}
          </Button>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Interval:</span>

            {/* ✅ Connected to YOUR Select UI */}
            <Select
              value={String(automation.intervalMinutes)}
              onValueChange={(value) =>
                onUpdateInterval(Number(value))
              }
              disabled={automation.isActive}
            >
              {/* 🔘 This is the BUTTON that opens the square */}
              <SelectTrigger size="sm" className="min-w-[130px]">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>

              {/* ⬇️ This is the SQUARE dropdown */}
              <SelectContent side="bottom" align="start">
                <SelectItem value="1">1 minute</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {automation.isActive && (
          <div className="flex items-center gap-2 text-sm text-black font-medium">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
            Automation Running
          </div>
        )}
      </div>
    </Card>
  )
}
