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
    <Card className="p-4 mb-6 shadow-none border-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggle}
            className="border-input data-[placeholder]:text-muted-foreground py-2 [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between cursor-pointer gap-2 rounded-md border px-3 text-sm whitespace-nowrap shadow-none bg-[#e7e7e7] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            disabled={disabled}
          >
            <Power className="w-4 h-4 mr-2" />
            {automation.isActive ? "Stop Automation" : "Start Automation"}
          </button>

          <div className="flex items-center gap-2">
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
                <Clock className="w-4 h-4 text-muted-foreground" />
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