/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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

import { Section } from '@/components/ui/section'
import type { ReactNode } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion-raised'

interface FAQItemProps {
  question: string
  answer: ReactNode
  value?: string
}

interface FAQProps {
  title?: string
  items?: FAQItemProps[] | false
  className?: string
}

export default function FAQ({
  title = 'Frequently Asked Questions',
  items = [
    {
      question: 'What is Falbor?',
      answer: (
        <>
          <p className='text-muted-foreground mb-4 max-w-[640px] text-balance'>Falbor is a free AI-powered website builder that generates complete websites from a simple natural language description you provide in a message.</p>
        </>
      ),
    },
    {
      question: 'How does Falbor work?',
      answer: (
        <>
          <p className='text-muted-foreground mb-4 max-w-[600px]'>Just describe your desired website in plain text—Falbor uses advanced AI to automatically create the code, design, and functionality tailored to your needs.</p>
        </>
      ),
    },
    {
      question: 'What AI models does Falbor use?',
      answer: (
        <>
          <p className='text-muted-foreground mb-4 max-w-[580px]'>Falbor integrates Gemini 3 Flash, Claude 4.5 Opus and Sonnet, and ChatGPT 5.2 and GPT codex Max 5.1, and Grok 4.1 Fast and Grok 3 Mini to deliver high-quality, context-aware website generation across multiple modalities.</p>
        </>
      ),
    },
    {
      question: 'Can I import GitHub projects into Falbor?',
      answer: <p className='text-muted-foreground mb-4 max-w-[580px]'>Absolutely. Paste a single GitHub repository link, and Falbor will import the entire project to build, enhance, or refactor it seamlessly.</p>,
    },
    {
      question: 'What are streams and how often is Falbor updated?',
      answer: <p className='text-muted-foreground mb-4 max-w-[580px]'>Streams enable real-time, collaborative AI interactions for dynamic development. Falbor receives weekly updates from our small team to add features and refine performance.</p>,
    },
  ],
  className,
}: FAQProps) {
  return (
    <Section className={className}>
      <div className='max-w-container mx-auto flex flex-col items-center gap-8 mt-10'>
        <h2 className='text-center text-black text-3xl leading-tight font-sans font-light sm:text-5xl'>
          {title}
        </h2>
        {items !== false && items.length > 0 && (
          <Accordion type='single' collapsible className='w-full max-w-[800px]'>
            {items.map((item, index) => (
              <AccordionItem key={index} value={item.value || `item-${index + 1}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </Section>
  )
}