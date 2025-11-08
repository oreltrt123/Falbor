"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { ChevronDown, AlertCircle } from "lucide-react"
import { MODEL_OPTIONS } from "@/lib/prompt"

interface ModelSelectorProps {
  currentModel: string
  onModelChange: (model: string) => void
  disabled?: boolean
}

export function ModelSelector({ currentModel, onModelChange, disabled = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [pendingModel, setPendingModel] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('bottom') // NEW: Dynamic position
  const buttonRef = useRef<HTMLButtonElement>(null) // NEW: Ref for positioning

  // NEW: Calculate position on open
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return

    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const dropdownHeight = 200 // Approximate height; adjust based on MODEL_OPTIONS length

    setDropdownPosition(spaceBelow >= dropdownHeight ? 'bottom' : 'top')
  }, [isOpen])

  const handleModelChange = (newModel: string) => {
    if (newModel !== currentModel) {
      setPendingModel(newModel)
      setShowWarning(true)
    } else {
      setIsOpen(false)
    }
  }

  const confirmModelChange = () => {
    if (pendingModel) {
      onModelChange(pendingModel)
      setPendingModel(null)
    }
    setShowWarning(false)
    setIsOpen(false)
  }

  const cancelModelChange = () => {
    setPendingModel(null)
    setShowWarning(false)
  }

  const currentModelName = MODEL_OPTIONS.find((m) => m.id === currentModel)?.name || "Select Model"

  // NEW: Dropdown styles based on position
  const dropdownStyles = {
    position: 'fixed' as const,
    width: '16rem', // w-64
    backgroundColor: '#1E1E21',
    border: '1px solid #3A3A3E',
    borderRadius: '0.5rem', // rounded-lg
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // shadow-lg
    zIndex: 50,
  } as React.CSSProperties

  if (dropdownPosition === 'bottom') {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      dropdownStyles.top = `${rect.bottom + 8}px` // mt-2
      dropdownStyles.left = `${rect.left}px`
    }
  } else {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      dropdownStyles.bottom = `${window.innerHeight - rect.top + 8}px` // mb-2 equivalent, flipped
      dropdownStyles.left = `${rect.left}px`
    }
  }

  // Dropdown content
  const dropdownContent = isOpen && (
    <div style={dropdownStyles}>
      <div className="p-2 space-y-1">
        {MODEL_OPTIONS.map((model) => (
          <button
            key={model.id}
            onClick={() => handleModelChange(model.id)}
            className={`w-full text-left px-3 py-2 rounded transition-colors ${
              currentModel === model.id ? "bg-blue-600 text-white" : "hover:bg-[#2A2A2E] text-white/75"
            }`}
          >
            {model.name}
          </button>
        ))}
      </div>
    </div>
  )

  // Warning modal (fixed, no change)
  const warningContent = showWarning && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1E1E21] border border-[#3A3A3E] rounded-lg p-6 max-w-md">
        <div className="flex gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-white mb-2">Switch Model?</h3>
            <p className="text-sm text-white/75 mb-4">
              Switching to a different model will start a new chat. The current conversation history will not be
              transferred to the new model. Are you sure you want to continue?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={cancelModelChange}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmModelChange}>
                Switch Model
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative">
      <Button 
        ref={buttonRef}
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(!isOpen)} 
        disabled={disabled} 
        className="gap-2"
      >
        {currentModelName}
        <ChevronDown className="w-4 h-4" />
      </Button>

      {/* Portal dropdown to body for no clipping */}
      {typeof window !== 'undefined' && isOpen && createPortal(dropdownContent, document.body)}

      {/* Portal warning for consistency */}
      {typeof window !== 'undefined' && showWarning && createPortal(warningContent, document.body)}
    </div>
  )
}