import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { neon } from "@neondatabase/serverless"
import { currentUser } from "@clerk/nextjs/server"
import { Users } from "lucide-react"

interface Project {
  id: string
  title: string
  updated_at: string
  preview_url?: string | null
  is_owner: boolean
  owner_name?: string
  collaborator_count?: number
}

interface User {
  id: string
  firstName?: string | null
  imageUrl: string
}

export async function ProjectsList({ userId }: { userId: string }) {
  const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

  // Get owned projects
  const ownedProjects = (await sql`
    SELECT
      p.id,
      p.title,
      p.updated_at,
      p.user_id,
      true as is_owner,
      (SELECT COUNT(*) FROM project_collaborators pc 
       WHERE pc.project_id = p.id AND pc.status = 'accepted') as collaborator_count,
      (SELECT a.preview_url
       FROM artifacts a
       WHERE a.project_id = p.id
       ORDER BY a.created_at DESC
       LIMIT 1) as preview_url
    FROM projects p
    WHERE p.user_id = ${userId}
    ORDER BY p.updated_at DESC
    LIMIT 10
  `) as Project[]

  // Get collaborated projects
  const collaboratedProjects = (await sql`
    SELECT
      p.id,
      p.title,
      p.updated_at,
      p.user_id,
      false as is_owner,
      (SELECT a.preview_url
       FROM artifacts a
       WHERE a.project_id = p.id
       ORDER BY a.created_at DESC
       LIMIT 1) as preview_url
    FROM projects p
    JOIN project_collaborators pc ON p.id = pc.project_id
    WHERE pc.user_id = ${userId} AND pc.status = 'accepted'
    ORDER BY p.updated_at DESC
    LIMIT 10
  `) as Project[]

  const allProjects = [...ownedProjects, ...collaboratedProjects].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )

  if (allProjects.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p>No projects yet. Start by creating your first project above!</p>
      </div>
    )
  }

  const current = await currentUser()
  if (!current) {
    return <div className="text-center text-destructive py-12">User not found.</div>
  }

  const user: User = {
    id: current.id,
    firstName: current.firstName,
    imageUrl: current.imageUrl || "/default-avatar.png",
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-10">
      {allProjects.map((project) => (
        <Link key={project.id} href={`/chat/${project.id}`}>
          <Card
            className="transition-colors duration-200 cursor-pointer 
            shadow-none h-full bg-[#ebebeb]
            border
            hover:border-[#d3d3d3] hover:bg-[#ebebebcb]"
          >
            <CardContent className="">
              {/* Project title above user info */}
              <div className="mb-3">
                <span className="block text-black text-sm font-medium truncate">{project.title}</span>
                {!project.is_owner && (
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Users className="h-3 w-3" />
                    Shared with you
                  </span>
                )}
              </div>
              {/* User info */}
              <div className="flex items-center space-x-3">
                <img
                  src={user.imageUrl || "/placeholder.svg"}
                  alt={`${user.firstName || "User"}'s profile`}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="text-xs text-black font-medium">
                    {project.is_owner ? (
                      <>
                        {user.firstName || "User"}
                        {project.collaborator_count && project.collaborator_count > 0 && (
                          <span className="text-gray-500 ml-1">
                            + {project.collaborator_count} collaborator{project.collaborator_count > 1 ? "s" : ""}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-600">{project.owner_name || "Shared Project"}</span>
                    )}
                  </p>
                  <p className="text-xs text-black/70">Updated {new Date(project.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
