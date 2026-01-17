import React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function HeroText() {
  return (
    <div className="relative p-2 rounded-4xl">
      {/* Background image behind text */}
    <div className='relative left-[-32px] top-11'>
      <img
        src="/bg/bg-text.png"
        alt=""
        width={800}
        className="absolute top-1/2 left-3/5 transform -translate-x-1/2 -translate-y-1/2  pointer-events-none"
      />
    </div>
    <span
        className="relative inline-flex items-center justify-center mx-[-0.02em]"
        style={{
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.25)) drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
        }}
      >
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="w-[0.32em] h-[0.32em] animate-diamond-rotate"
            filter="url(#diamondGlow)"
          >
            {/* Main diamond shape with clean gradient */}
            <path d="M50 8 L92 50 L50 92 L8 50 Z" fill="url(#diamondGradient)" />
            {/* Top-left shine facet for 3D polish */}
            <path d="M50 8 L8 50 L50 50 Z" fill="url(#diamondShine)" />
            {/* Subtle inner edge highlight */}
            <path d="M50 18 L82 50 L50 82 L18 50 Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          </svg>
        </span>
      </span>
        <h2 className="font-medium text-muted-foreground tracking-tight relative text-3xl font-sans text-center">
          Create anything, from anywhere like a{" "} <span className="font-semibold text-primary">pro.</span>
         <svg
            viewBox="0 0 100 100"
            className="w-[0.32em] h-[0.32em] animate-diamond-rotate"
            filter="url(#diamondGlow)"
          >
            {/* Main diamond shape with clean gradient */}
            <path d="M50 8 L92 50 L50 92 L8 50 Z" fill="url(#diamondGradient)" />
            {/* Top-left shine facet for 3D polish */}
            <path d="M50 8 L8 50 L50 50 Z" fill="url(#diamondShine)" />
            {/* Subtle inner edge highlight */}
            <path d="M50 18 L82 50 L50 82 L18 50 Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          </svg>
        {/* <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <img
                  src="/icons/pro.png"
                  alt=""
                  width={30}
                  className="inline-block align-baseline mb-[-5px] ml-[6px]"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pro</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider> */}
      </h2>

      <p className="relative text-black/70 font-medium text-[13px] text-center w-full mt-[-10px]">
        Build full projects with one prompt. Launch complete websites with one link.
      </p>
    </div>
  )
}

export default HeroText