/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * FeatureShowcase.tsx
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

import { MultiStepLoader } from '@/components/multi-step-loader'
import React, { useEffect, useState } from 'react'
import { LogoLarge } from '../common/logo/LogoImage'

/**
 * FeatureShowcase component that uses a multi-step loader to cycle through feature highlights automatically
 */
const getFeatureItems = () => [
  { id: 1, text: 'AI-Powered Development' },
  { id: 2, text: 'Cloud IDE Environment' },
  { id: 3, text: 'Open Source Core' },
  { id: 4, text: 'GitHub Integration' },
  { id: 5, text: 'Custom Domain Deployment' },
  { id: 6, text: 'Multi-Model AI Support' },
  { id: 7, text: 'Real-Time Preview' },
  { id: 8, text: 'Welcome' },
]

const getLoadingStates = () =>
    getFeatureItems().map((item) => ({
      text: item.text,
    }))

export default function FeatureShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const featureItems = getFeatureItems()
  const loadingStates = getLoadingStates()

  // Auto carousel logic
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % featureItems.length)
    }, 1500) // every 1.5 seconds

    return () => clearInterval(interval)
  }, [featureItems.length])

  return (
      <div className='relative w-full z-20 hidden lg:flex border-l border-[#4444442d] overflow-hidden bg-background-landing items-center justify-center flex-col'>
        {/* Logo section */}
        <div className='w-full flex flex-col items-center justify-center h-full'>
          <div className='h-[120px] lg:h-[150px] flex items-center justify-center'>
            <div className='flex justify-center drop-shadow-glowPrimary'>
              <LogoLarge />
            </div>
          </div>

          {/* Feature presentation - use MultiStepLoader to auto-cycle through states */}
          <div className='flex items-center justify-center backdrop-blur-2xl h-[300px] lg:h-[350px] w-full relative'>
            <div className='relative w-full max-w-md mx-auto flex justify-center'>
              <MultiStepLoader
                  loadingStates={loadingStates}
                  loading={true}
                  duration={1500}
                  loop={true}
              />
            </div>

            {/* Enhance radial gradient mask effect */}
            <div
                className='absolute inset-x-0 top-0 bottom-0 z-20 pointer-events-none'
                style={{
                  background:
                      'linear-gradient(to bottom, hsl(var(--background-landing)) 0%, hsla(var(--background-landing), 0) 20%, hsla(var(--background-landing), 0) 80%, hsl(var(--background-landing)) 100%)',
                }}
            />
            <div className='bg-background-landing inset-x-0 z-10 bottom-0 h-full absolute [mask-image:radial-gradient(600px_at_center,transparent_30%,white)]' />
          </div>
        </div>
      </div>
  )
}