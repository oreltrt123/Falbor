import { Navbar } from '@/components/navbar/navbar'
import { ProjectsList } from '@/components/project/projects-list'
import { auth } from '@clerk/nextjs/server'
import React from 'react'

export async function page() {
  const { userId } = await auth()
  return (
    <div className="relative min-h-screen flex flex-col bg-[#161616] overflow-hidden">
      <div className="p-40">
        {userId && (
          <div className="relative z-10 px-4 pb-8">
            <h2 className="text-2xl font-semibold text-white absolute ml-12 mt-[-10px]">Your Projects</h2>
            <ProjectsList userId={userId} />
          </div>
        )}
      </div>
    </div>
  )
}

export default page