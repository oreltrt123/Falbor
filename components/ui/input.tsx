import * as React from 'react'

import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isActive?: boolean;
}

function Input({ className, type, isActive = false, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
        className={cn(
          "p-3 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
          "prose prose-sm max-w-none",
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-9 w-full min-w-0 bg-transparent px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600",
          "[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-red-600",
          "[&_a]:text-blue-600 [&_a]:underline",
          "[&_ol]:list-decimal [&_ol]:pl-5",
          "[&_ul]:list-disc [&_ul]:pl-5",
        )}
      {...props}
    />
  )
}

export { Input }
// import * as React from 'react'

// import { cn } from '@/lib/utils'

// interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
//   isActive?: boolean;
// }

// function Input({ className, type, isActive = false, ...props }: InputProps) {
//   return (
//     <input
//       type={type}
//       data-slot="input"
//       className={cn(
//         'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
//         // 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
//         'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
//         'text-black',
//         className,
//       )}
//       style={{
//         backgroundColor: "#ffffff",
//         borderRadius: "6px",
//         border: "1px solid #dbd9d9b2",
//         transition: "background-image 200ms ease",
//         backgroundImage: `
//           linear-gradient(#ffffff, #ffffff),
//           /* TOP border (colored section only) */
//           linear-gradient(
//             to right,
//             ${isActive ? "#f3581f" : "rgba(193,95,60,0.35)"} 0%,
//             rgba(193, 95, 60, ${isActive ? "1" : "0.45"}) 18%,
//             rgba(193, 95, 60, ${isActive ? "0.85" : "0.25"}) 35%,
//             rgba(219, 217, 217, 0.7) 50%,
//             #dbd9d9b2 60%
//           ),
//           /* LEFT border (colored section only) */
//           linear-gradient(
//             to bottom,
//             ${isActive ? "#c15f3c" : "rgba(193,95,60,0.35)"} 0%,
//             rgba(193, 95, 60, ${isActive ? "1" : "0.45"}) 22%,
//             rgba(193, 95, 60, ${isActive ? "0.85" : "0.25"}) 40%,
//             rgba(219, 217, 217, 0.7) 55%,
//             #dbd9d9b2 65%
//           )
//         `,
//         backgroundOrigin: "padding-box, border-box, border-box",
//         backgroundClip: "padding-box, border-box, border-box",
//       }}
//       {...props}
//     />
//   )
// }

// export { Input }