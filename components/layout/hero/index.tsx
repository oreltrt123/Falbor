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

      <h1 className="relative text-3xl font-sans font-light tracking-tight text-black/90 text-center">
        Create anything, from anywhere like a
        <TooltipProvider>
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
        </TooltipProvider>
        .
      </h1>

      <p className="relative text-black/90 font-sans text-[14px] font-light text-center w-full">
        Build full projects with one prompt. Launch complete websites with one link.
      </p>
    </div>
  )
}

export default HeroText
