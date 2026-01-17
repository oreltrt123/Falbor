/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * accordion-raised.tsx
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

'use client'

import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { PlusIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import type * as React from 'react'

const Accordion = AccordionPrimitive.Root

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot='accordion-item' className={className} {...props} />
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className='flex'>
      <AccordionPrimitive.Trigger
        data-slot='accordion-trigger'
        className={cn(
          'text-md text-black glass-4 hover:glass-5 hover:text-black/90 bg-[#e4e4e4a8] mb-3 flex flex-1 items-center justify-between rounded-lg px-4 py-4 text-left font-medium shadow-none transition-all [&[data-state=open]_svg]:rotate-45',
          className
        )}
        {...props}
      >
        {children}
        <div className='icon bg-[#8d8d8d49] dark:bg-muted/50 rounded-full p-2'>
          <PlusIcon className='text-white size-4 shrink-0 transition-transform duration-200' />
        </div>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot='accordion-content'
      className='data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm'
      {...props}
    >
      <div className={cn('px-4 pt-0 pb-5', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }