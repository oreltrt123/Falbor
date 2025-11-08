import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { neon } from "@neondatabase/serverless"

interface Project {
  id: string
  title: string
  updated_at: string
}

export async function ProjectsList({ userId }: { userId: string }) {
  const sql = neon(process.env.NEON_NEON_DATABASE_URL!)

  const projects = await sql<Project[]>`
    SELECT id, title, updated_at 
    FROM projects 
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 10
  `

  if (projects.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p>No projects yet. Start by creating your first project above!</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link key={project.id} href={`/chat/${project.id}`}>
          <Card 
          className="transition-colors cursor-pointer 
          shadow-none h-full bg-[#1b1b1bc4]
          hover:bg-[#1b1b1b] border-none">
            <CardHeader>
              <CardTitle className="text-lg text-white font-sans font-light">{project.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mt-[-30px]">
                Updated {new Date(project.updated_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
