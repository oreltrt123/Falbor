import * as React from 'react'

import { cn } from '@/lib/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isActive?: boolean;
}

function Textarea({ className, isActive = false, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md bg-transparent px-2 pt-2 pb-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'resize-none overflow-y-auto text-black',
        className,
      )}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "6px",
        border: "1px solid #dbd9d9b2",
        transition: "background-image 200ms ease",
        backgroundImage: `
          linear-gradient(#ffffff, #ffffff),
          /* TOP border (colored section only) */
          linear-gradient(
            to right,
            ${isActive ? "#f3581f" : "rgba(193,95,60,0.35)"} 0%,
            rgba(193, 95, 60, ${isActive ? "1" : "0.45"}) 18%,
            rgba(193, 95, 60, ${isActive ? "0.85" : "0.25"}) 35%,
            rgba(219, 217, 217, 0.7) 50%,
            #dbd9d9b2 60%
          ),
          /* LEFT border (colored section only) */
          linear-gradient(
            to bottom,
            ${isActive ? "#c15f3c" : "rgba(193,95,60,0.35)"} 0%,
            rgba(193, 95, 60, ${isActive ? "1" : "0.45"}) 22%,
            rgba(193, 95, 60, ${isActive ? "0.85" : "0.25"}) 40%,
            rgba(219, 217, 217, 0.7) 55%,
            #dbd9d9b2 65%
          )
        `,
        backgroundOrigin: "padding-box, border-box, border-box",
        backgroundClip: "padding-box, border-box, border-box",
        scrollbarWidth: "thin",
      }}
      {...props}
    />
  )
}

export { Textarea }