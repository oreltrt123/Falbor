"use client"

import type React from "react"

import { cn } from "@/lib/utils"

export type CardDesignType = "none" | "gradient-gold" | "neon-blue" | "rainbow" | "fire" | "cosmic"

export interface CardDesign {
  id: CardDesignType
  name: string
  isPro: boolean
  preview: string
}

export const CARD_DESIGNS: CardDesign[] = [
  {
    id: "none",
    name: "Default",
    isPro: false,
    preview: "No special frame",
  },
  {
    id: "gradient-gold",
    name: "Golden Glow",
    isPro: true,
    preview: "Luxurious gold gradient border with shimmer",
  },
  {
    id: "neon-blue",
    name: "Neon Pulse",
    isPro: true,
    preview: "Electric blue neon glow effect",
  },
  {
    id: "rainbow",
    name: "Rainbow Wave",
    isPro: true,
    preview: "Animated rainbow gradient border",
  },
  {
    id: "fire",
    name: "Flame Edge",
    isPro: true,
    preview: "Fiery orange and red animated border",
  },
  {
    id: "cosmic",
    name: "Cosmic Dust",
    isPro: true,
    preview: "Purple and pink galaxy-inspired glow",
  },
]

interface CardFrameProps {
  design: CardDesignType
  children: React.ReactNode
  className?: string
}

export function CardFrame({ design, children, className }: CardFrameProps) {
  if (design === "none") {
    return <div className={className}>{children}</div>
  }

  const frameStyles: Record<CardDesignType, string> = {
    none: "",
    "gradient-gold": "card-frame-gold",
    "neon-blue": "card-frame-neon",
    rainbow: "card-frame-rainbow",
    fire: "card-frame-fire",
    cosmic: "card-frame-cosmic",
  }

  return (
    <div className={cn("card-frame-wrapper", frameStyles[design], className)}>
      <div className="card-frame-inner">{children}</div>
      <style jsx>{`
        .card-frame-wrapper {
          position: relative;
          border-radius: 12px;
          padding: 3px;
        }
        
        .card-frame-inner {
          position: relative;
          z-index: 1;
          border-radius: 10px;
          overflow: hidden;
          background: var(--background);
        }
        
        /* Golden Glow */
        .card-frame-gold {
          background: linear-gradient(135deg, #ffd700, #ffb347, #ffd700, #ff8c00, #ffd700);
          background-size: 300% 300%;
          animation: goldShimmer 3s ease infinite;
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.2);
        }
        
        @keyframes goldShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        /* Neon Blue */
        .card-frame-neon {
          background: linear-gradient(135deg, #00f5ff, #0066ff, #00f5ff);
          background-size: 200% 200%;
          animation: neonPulse 2s ease-in-out infinite;
          box-shadow: 0 0 15px rgba(0, 245, 255, 0.6), 0 0 30px rgba(0, 102, 255, 0.4), inset 0 0 10px rgba(0, 245, 255, 0.2);
        }
        
        @keyframes neonPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(0, 245, 255, 0.6), 0 0 30px rgba(0, 102, 255, 0.4); }
          50% { box-shadow: 0 0 25px rgba(0, 245, 255, 0.8), 0 0 50px rgba(0, 102, 255, 0.6); }
        }
        
        /* Rainbow Wave */
        .card-frame-rainbow {
          background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff, #ff0000);
          background-size: 400% 100%;
          animation: rainbowWave 4s linear infinite;
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.3);
        }
        
        @keyframes rainbowWave {
          0% { background-position: 0% 50%; }
          100% { background-position: 400% 50%; }
        }
        
        /* Fire Edge */
        .card-frame-fire {
          background: linear-gradient(135deg, #ff4500, #ff6347, #ffd700, #ff4500, #ff0000);
          background-size: 300% 300%;
          animation: fireFlicker 1.5s ease-in-out infinite;
          box-shadow: 0 0 20px rgba(255, 69, 0, 0.5), 0 0 40px rgba(255, 99, 71, 0.3);
        }
        
        @keyframes fireFlicker {
          0%, 100% { 
            background-position: 0% 50%; 
            box-shadow: 0 0 20px rgba(255, 69, 0, 0.5), 0 0 40px rgba(255, 99, 71, 0.3);
          }
          25% { background-position: 50% 100%; }
          50% { 
            background-position: 100% 50%; 
            box-shadow: 0 0 30px rgba(255, 69, 0, 0.7), 0 0 60px rgba(255, 99, 71, 0.5);
          }
          75% { background-position: 50% 0%; }
        }
        
        /* Cosmic Dust */
        .card-frame-cosmic {
          background: linear-gradient(135deg, #9b59b6, #3498db, #e91e63, #9b59b6);
          background-size: 300% 300%;
          animation: cosmicDust 5s ease infinite;
          box-shadow: 0 0 25px rgba(155, 89, 182, 0.5), 0 0 50px rgba(233, 30, 99, 0.3);
        }
        
        @keyframes cosmicDust {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  )
}

interface CardDesignSelectorProps {
  selectedDesign: CardDesignType
  onSelect: (design: CardDesignType) => void
  hasSubscription: boolean
}

export function CardDesignSelector({ selectedDesign, onSelect, hasSubscription }: CardDesignSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {CARD_DESIGNS.map((design) => {
        const isLocked = design.isPro && !hasSubscription
        const isSelected = selectedDesign === design.id

        return (
          <button
            key={design.id}
            onClick={() => !isLocked && onSelect(design.id)}
            disabled={isLocked}
            className={cn(
              "relative p-3 rounded-lg border-2 transition-all text-left",
              isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              isLocked && "opacity-60 cursor-not-allowed",
            )}
          >
            {/* Preview */}
            <div className="mb-2">
              <CardFrame design={design.id}>
                <div className="w-full h-12 bg-muted rounded" />
              </CardFrame>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{design.name}</span>
              {design.isPro && !hasSubscription && (
                <span className="text-xs bg-[#c15f3c] text-white px-1.5 py-0.5 rounded">Pro</span>
              )}
            </div>

            {isSelected && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
