import { Navbar } from '@/components/navbar/navbar'
import { ProjectsList } from '@/components/projects-list'
import { auth } from '@clerk/nextjs/server'
import React from 'react'

export async function page() {
  const { userId } = await auth()
  return (
    <div className="relative min-h-screen flex flex-col bg-[#161616] overflow-hidden">
      <Navbar />
      <div className="p-10">
        {userId && (
          <div className="relative z-10 px-4 pb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">Your Projects</h2>
            <ProjectsList userId={userId} />
          </div>
        )}
      </div>
    </div>
  )
}

export default page