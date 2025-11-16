// AutomationDialog.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Clock, ChevronDown, AlertCircle } from 'lucide-react'
import { utcToIsraelTime } from "@/lib/common/timezone/timezone-utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { cn } from "@/lib/utils"
import { Badge } from "../ui/badge"
import Link from "next/link"

interface AutomationSettings {
  selectedModel: string
  dailyTime: string // "HH:MM:SS" UTC stored internally
  maxMessages: number
  isActive: boolean
  timezone: string
}

interface ModelOption {
  label: string
  icon: string
  color: string
  soon?: string
}

export type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss"

interface AutomationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  automationSettings: AutomationSettings | null
  onUpdateSettings: (updater: (prev: AutomationSettings) => AutomationSettings) => void
  onSave: () => void
  onTestNow: () => void
  loading: boolean
  modelOptions: Record<ModelType, ModelOption>
  currentParsed: { hour: number; minute: number; second: number; timezone: string }
  onUpdateTime: (key: "hour" | "minute" | "second", val: number | string) => void
}

export function AutomationDialog({
  open,
  onOpenChange,
  automationSettings,
  onUpdateSettings,
  onSave,
  onTestNow,
  loading,
  modelOptions,
  currentParsed,
  onUpdateTime,
}: AutomationDialogProps) {
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showHourDropdown, setShowHourDropdown] = useState(false)
  const [showMinuteDropdown, setShowMinuteDropdown] = useState(false)
  const [showSecondDropdown, setShowSecondDropdown] = useState(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const hourDropdownRef = useRef<HTMLDivElement>(null)
  const minuteDropdownRef = useRef<HTMLDivElement>(null)
  const secondDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false)
      }
      if (hourDropdownRef.current && !hourDropdownRef.current.contains(event.target as Node)) {
        setShowHourDropdown(false)
      }
      if (minuteDropdownRef.current && !minuteDropdownRef.current.contains(event.target as Node)) {
        setShowMinuteDropdown(false)
      }
      if (secondDropdownRef.current && !secondDropdownRef.current.contains(event.target as Node)) {
        setShowSecondDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!automationSettings) return null

  const handleModelChange = (model: ModelType) => {
    const option = modelOptions[model]
    if (option.soon) {
      alert(`${option.label} is coming soon!`)
      return
    }
    onUpdateSettings((prev) => ({ ...prev, selectedModel: model }))
    setShowModelDropdown(false)
  }

  const selectedOption = modelOptions[automationSettings.selectedModel as ModelType]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-y-auto bg-[#ffffff] border-0 p-0 sm:max-w-md">
        <DialogHeader className="p-6 pb-6 mb-[-30px]">
          <DialogTitle className="text-black text-xl flex items-center gap-2">
             AI Automation Settings 
                <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-[#e4e4e4b4] text-black">Beta</Badge>
                    </TooltipTrigger>
        
                    <TooltipContent className="w-50 p-3">
                        <p className="text-[12px]">This Beta version may contain problems. We are here to solve them. If there is a problem, you can contact the 
                         <span className="ml-1"><Link className="text-[#0099FF]" href={'/contact'}>Contact</Link> page.</span></p>
                    </TooltipContent>
                </Tooltip>
          </DialogTitle>
          <p className="text-black/60 text-xs">Times displayed and set in Israel timezone (UTC+2/UTC+3)</p>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
          className="px-6 pb-6 space-y-4"
        >
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-black block mb-1">Model</label>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="w-4 h-4 text-black mb-1" /> 
                    </TooltipTrigger>
        
                    <TooltipContent className="w-50 p-3">
                        <p className="text-[12px]">The model you select here will be used by the AI to generate the project.</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="relative" ref={modelDropdownRef}>
              <Button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="shadow-none w-full justify-start p-2 bg-[#e4e4e4b4] text-black hover:bg-[#e4e4e4] h-auto focus:outline-none focus:border-[#0099FF] focus:border-1 border border-[#e4e4e400]"
                disabled={loading}
                variant="ghost"
              >
                <img
                  src={selectedOption.icon || "/placeholder.svg"}
                  alt=""
                  className={`w-3.5 h-3.5 ${selectedOption.color} mr-2`}
                />
                <span className="text-black/75">{selectedOption.label}</span>
                {selectedOption.soon && (
                  <span className="text-xs bg-[#333333e7] text-white/70 p-1 rounded-4xl ml-1">SOON</span>
                )}
                <ChevronDown className="w-3 h-3 text-black/50 ml-auto" />
              </Button>

              {showModelDropdown && (
                <div className="absolute left-1/2 top-full -translate-x-1/2 bg-white border border-[#e0e0e0c9] rounded-md overflow-hidden p-1 z-50 min-w-[50%] mt-[-3vh]">
                  {Object.entries(modelOptions).map(([key, option]) => {
                    const { label, icon, color, soon } = option
                    const modelKey = key as ModelType
                    const isSelected = automationSettings.selectedModel === modelKey
                    const isComingSoon = !!soon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleModelChange(modelKey)}
                        disabled={isComingSoon}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4] ${
                          isSelected ? "font-bold" : ""
                        } ${isComingSoon ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <img src={icon || "/placeholder.svg"} alt="" className={`w-3.5 h-3.5 ${color}`} />
                        <span className="text-black/75">{label}</span>
                        {soon && <span className="text-xs text-white/70 bg-[#333333e7] w-[35%] rounded-4xl">SOON</span>}
                        {isSelected && !isComingSoon && <span className="ml-auto text-green-400">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
            <label className="text-black block mb-2">Daily Time</label>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="w-4 h-4 text-black mb-1" /> 
                    </TooltipTrigger>
        
                    <TooltipContent className="w-50 p-3">
                        <p className="text-[12px]">The selected time determines when the AI will start creating the project. You can view it on the Projects page.</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="w-4 h-4 text-[#ff0000] mb-1" /> 
                    </TooltipTrigger>
        
                    <TooltipContent className="w-50 p-3">
                        <p className="text-[12px]">Note: time may vary by country.</p>
                    </TooltipContent>
                </Tooltip>
             </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="relative" ref={hourDropdownRef}>
                <Button
                  type="button"
                  onClick={() => setShowHourDropdown(!showHourDropdown)}
                  className="shadow-none w-full justify-start p-2 bg-[#e4e4e4b4] text-black hover:bg-[#e4e4e4] h-auto text-sm focus:outline-none focus:border-[#0099FF] focus:border-1 border border-[#e4e4e400]"
                  disabled={loading}
                  variant="ghost"
                >
                  <span className="text-black/75">{currentParsed.hour.toString().padStart(2, "0")}</span>
                  <ChevronDown className="w-3 h-3 text-black/50 ml-auto" />
                </Button>
                {showHourDropdown && (
                  <div className="absolute left-0 top-full bg-[#ffffff] border border-[#e0e0e0c9] rounded-md overflow-hidden p-1 z-50 w-full max-h-40 overflow-y-auto">
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          onUpdateTime("hour", h)
                          setShowHourDropdown(false)
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]"
                      >
                        <span className="text-black/75">{h.toString().padStart(2, "0")}</span>
                        {currentParsed.hour === h && <span className="text-green-400">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={minuteDropdownRef}>
                <Button
                  type="button"
                  onClick={() => setShowMinuteDropdown(!showMinuteDropdown)}
                  className="shadow-none w-full justify-start p-2 bg-[#e4e4e4b4] text-black hover:bg-[#e4e4e4] h-auto text-sm focus:outline-none focus:border-[#0099FF] focus:border-1 border border-[#e4e4e400]"
                  disabled={loading}
                  variant="ghost"
                >
                  <span className="text-black/75">{currentParsed.minute.toString().padStart(2, "0")}</span>
                  <ChevronDown className="w-3 h-3 text-black/50 ml-auto" />
                </Button>
                {showMinuteDropdown && (
                  <div className="absolute left-0 top-full bg-[#ffffff] border border-[#e0e0e0c9] rounded-md overflow-hidden p-1 z-50 w-full max-h-40 overflow-y-auto">
                    {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          onUpdateTime("minute", m)
                          setShowMinuteDropdown(false)
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]"
                      >
                        <span className="text-black/75">{m.toString().padStart(2, "0")}</span>
                        {currentParsed.minute === m && <span className="text-green-400">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={secondDropdownRef}>
                <Button
                  type="button"
                  onClick={() => setShowSecondDropdown(!showSecondDropdown)}
                  className="w-full justify-start p-2 bg-[#e4e4e4b4] text-black hover:bg-[#e4e4e4] shadow-none h-auto text-sm focus:outline-none focus:border-[#0099FF] focus:border-1 border border-[#e4e4e400]"
                  disabled={loading}
                  variant="ghost"
                >
                  <span className="text-black/75">{currentParsed.second.toString().padStart(2, "0")}</span>
                  <ChevronDown className="w-3 h-3 text-black/50 ml-auto" />
                </Button>
                {showSecondDropdown && (
                  <div className="absolute left-0 top-full bg-[#ffffff] border border-[#e0e0e0c9] rounded-md overflow-hidden p-1 z-50 w-full max-h-40 overflow-y-auto">
                    {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          onUpdateTime("second", s)
                          setShowSecondDropdown(false)
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-sm hover:bg-[#e4e4e4]"
                      >
                        <span className="text-black/75">{s.toString().padStart(2, "0")}</span>
                        {currentParsed.second === s && <span className="text-green-400">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-black/50 text-xs">Timezone: {currentParsed.timezone}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
            <label className="text-black block mb-1">Max Messages</label>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="w-4 h-4 text-black mb-1" /> 
                    </TooltipTrigger>
        
                    <TooltipContent className="w-50 p-3">
                        <p className="text-[12px]">The number you choose here will be the amount of messages the AI ​​will create in the project.</p>
                    </TooltipContent>
                </Tooltip>
             </div>
            <input
              type="number"
              min={2}
              max={10}
              value={automationSettings.maxMessages}
              onChange={(e) =>
                onUpdateSettings((prev) => ({ ...prev, maxMessages: parseInt(e.target.value) || 2 }))
              }
              className="w-full p-2 bg-[#e4e4e4b4] text-black rounded focus:outline-none focus:border-[#0099FF] focus:border-1 border border-[#e4e4e400]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={automationSettings.isActive}
              onChange={(e) =>
                onUpdateSettings((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="rounded"
            />
            <label htmlFor="active" className="text-black text-sm">
              Activate Daily Auto-Generation
            </label>
          </div>
        </form>
        <DialogFooter className="px-6 pb-6 flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={onTestNow}
              disabled={loading || !automationSettings.isActive}
              className="flex-1 bg-[#0099FF] hover:bg-[#0099FF]"
            >
              Create a project
            </Button>
          </TooltipTrigger>
        
          <TooltipContent className="w-50 p-3">
            <p className="text-[12px]">When you create the project, AI will automatically generate it from scratch, including messages, ideas, and editable code. You can view and manage the project on the Projects page.</p>
          </TooltipContent>
        </Tooltip>

          <Button
            type="button"
            onClick={onSave}
            variant="secondary"
            disabled={loading}
            className="flex-1 bg-[#e4e4e4b4] hover:bg-[#e4e4e4b4]"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}