/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * glow.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import { cva, type VariantProps } from 'class-variance-authority'
import type React from 'react'
import { cn } from '@/lib/utils'

const glowVariants = cva('absolute w-full z-0', {
  variants: {
    variant: {
      top: 'top-0',
      above: '-top-[128px]',
      bottom: 'bottom-0',
      below: '-bottom-[128px]',
      center: 'top-[50%]',
    },
  },
  defaultVariants: {
    variant: 'top',
  },
})

function Glow({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof glowVariants>) {
  return (
    <div data-slot='glow' className={cn(glowVariants({ variant }), className)} {...props}>
      <div
        className={cn(
          'from-brand-foreground/50 to-brand-foreground/0 absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-radial from-10% to-60% opacity-20 sm:h-[512px] dark:opacity-100 z-0',
          variant === 'center' && '-translate-y-1/2'
        )}
      />
      <div
        className={cn(
          'from-brand/30 to-brand-foreground/0 absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-200 rounded-[50%] bg-radial from-10% to-60% opacity-20 sm:h-[256px] dark:opacity-100 z-0',
          variant === 'center' && '-translate-y-1/2'
        )}
      />
    </div>
  )
}

export default Glow