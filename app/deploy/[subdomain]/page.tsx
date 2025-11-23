import { db } from '@/config/db'
import { deployments, projects, files } from '@/config/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { DeployedSiteRenderer } from '@/components/deployed-site-renderer'

export default async function DeployedSitePage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params

  // Find deployment by subdomain pattern (extract project ID from subdomain)
  // Subdomain format: projectid or username-projectid
  const projectId = subdomain

  // Get deployment
  const [deployment] = await db
    .select()
    .from(deployments)
    .innerJoin(projects, eq(deployments.projectId, projects.id))
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!deployment || !deployment.deployments.isPublic) {
    notFound()
  }

  // Get all project files
  const projectFiles = await db
    .select()
    .from(files)
    .where(eq(files.projectId, projectId))
    .orderBy(files.path)

  if (projectFiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">No Content</h1>
          <p className="text-gray-600 mt-2">This site has no files yet.</p>
        </div>
      </div>
    )
  }

  return (
    <DeployedSiteRenderer 
      files={projectFiles}
      projectTitle={deployment.projects.title}
      showBranding={deployment.deployments.showBranding}
    />
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const projectId = subdomain

  const [deployment] = await db
    .select()
    .from(deployments)
    .innerJoin(projects, eq(deployments.projectId, projects.id))
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!deployment) {
    return {
      title: 'Site Not Found',
    }
  }

  return {
    title: deployment.projects.title,
    description: `Deployed site: ${deployment.projects.title}`,
  }
}
