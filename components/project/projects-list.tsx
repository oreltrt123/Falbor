import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { neon } from "@neondatabase/serverless"
import { currentUser } from "@clerk/nextjs/server"

interface Project {
  id: string
  title: string
  updated_at: string
  preview_url?: string | null
}

interface User {
  id: string
  firstName?: string | null
  imageUrl: string
}

export async function ProjectsList({ userId }: { userId: string }) {
  const sql = neon(process.env.NEON_NEON_DATABASE_URL!)
  const projects = await sql<Project[]>`SELECT
      p.id,
      p.title,
      p.updated_at,
      (SELECT a.preview_url
       FROM artifacts a
       WHERE a.project_id = p.id
       ORDER BY a.created_at DESC
       LIMIT 1) as preview_url
    FROM projects p
    WHERE p.user_id = ${userId}
    ORDER BY p.updated_at DESC
    LIMIT 10`

  if (projects.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p>No projects yet. Start by creating your first project above!</p>
      </div>
    )
  }

  const current = await currentUser()
  if (!current) {
    return (
      <div className="text-center text-destructive py-12">
        User not found.
      </div>
    )
  }

  const user: User = {
    id: current.id,
    firstName: current.firstName,
    imageUrl: current.imageUrl || "/default-avatar.png",
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-10">
      {projects.map((project) => (
        <Link key={project.id} href={`/chat/${project.id}`}>
          <Card
            className="transition-colors duration-200 cursor-pointer 
            shadow-none h-full bg-[#1b1b1b]
            border border-transparent 
            hover:border-[#3b3b3fbe] hover:bg-[#1b1b1b]"
          >
            <CardContent className="">
              {/* Project title above user info */}
              <div className="mb-3">
                <span className="block text-white text-sm font-medium truncate">
                  {project.title}
                </span>
              </div>
              {/* User info */}
              <div className="flex items-center space-x-3">
                <img
                  src={user.imageUrl}
                  alt={`${user.firstName || "User"}'s profile`}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <div>
                  <p className="text-xs text-white font-medium">
                    {user.firstName || "User"} <span className="text-white/70">Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}