// New File: app/deploy/[subdomain]/page.tsx
// Added this new dynamic route to serve the deployed project.
// For React projects, it renders a full-page SandpackPreview using the project's files from the DB.
// For Python, it shows a not-supported message.
// This ensures the deployment URL actually works by hosting a client-side preview of the app.
// In production, configure your domain (e.g., Vercel) to handle wildcard subdomains (*.falbor.xyz).
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react"
import { db } from '@/config/db'
import { deployments, files } from '@/config/schema'
import { eq } from 'drizzle-orm'

export default async function DeployPage({ params }: { params: { subdomain: string } }) {
  const subdomain = params.subdomain

  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.subdomain, subdomain))
    .limit(1)

  if (!deployment) {
    return <div className="flex items-center justify-center h-screen text-xl">Deployment not found</div>
  }

  const projectFiles = await db
    .select()
    .from(files)
    .where(eq(files.projectId, deployment.projectId))

  if (projectFiles.length === 0) {
    return <div className="flex items-center justify-center h-screen text-xl">No files available</div>
  }

  // Determine project type (similar to CodePreview)
  const hasPy = projectFiles.some((f) => f.language === "python" || f.path.endsWith(".py"))
  const hasJsTs = projectFiles.some(
    (f) =>
      f.language === "javascript" ||
      f.language === "typescript" ||
      f.path.match(/\.j(sx?)$/) ||
      f.path.match(/\.ts(x?)$/),
  )
  const projectType = hasPy && !hasJsTs ? "python" : hasJsTs && !hasPy ? "react" : null

  if (projectType === "python") {
    return <div className="flex items-center justify-center h-screen text-xl">Python project deployment not supported yet</div>
  }

  if (projectType !== "react") {
    return <div className="flex items-center justify-center h-screen text-xl">Unsupported project type</div>
  }

  // Prepare Sandpack files
  const sandpackFiles = projectFiles.reduce((acc: Record<string, string>, file) => {
    const key = `/${file.path.startsWith("/") ? file.path.slice(1) : file.path}`
    acc[key] = file.content
    return acc
  }, {})

  const hasTs = projectFiles.some((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"))
  const template = hasTs ? "react-ts" : "react"

  const defaultDependencies = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
  }

  return (
    <SandpackProvider
      files={sandpackFiles}
      template={template}
      theme="light"
      customSetup={{ dependencies: defaultDependencies }}
      options={{ externalResources: ["https://cdn.tailwindcss.com"] }}
    >
      <SandpackPreview style={{ height: "100vh" }} showNavigator={false} />
    </SandpackProvider>
  )
}