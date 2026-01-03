import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { deployments, projects, files } from "@/config/schema"
import { eq, and } from "drizzle-orm"

const MAIN_TSX_CONTENT = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
<App />
</React.StrictMode>,
)`;

const INDEX_CSS_CONTENT = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    let projectFiles = await db.select().from(files).where(eq(files.projectId, projectId))

    const hasPy = projectFiles.some(f => f.path.endsWith('.py') || f.language === 'python');
    const hasJsTs = projectFiles.some(f => 
      f.language === 'javascript' || f.language === 'typescript' ||
      f.path.match(/\.j(sx?)$/) || f.path.match(/\.ts(x?)$/)
    );

    if (hasJsTs && !hasPy) {
      const hasMainTsx = projectFiles.some(f => f.path === 'src/main.tsx');
      const hasIndexCss = projectFiles.some(f => f.path === 'src/index.css');
      const toInsert = [];
      if (!hasMainTsx) {
        toInsert.push({
          projectId,
          path: 'src/main.tsx',
          content: MAIN_TSX_CONTENT,
          language: 'tsx',
        });
      }
      if (!hasIndexCss) {
        toInsert.push({
          projectId,
          path: 'src/index.css',
          content: INDEX_CSS_CONTENT,
          language: 'css',
        });
      }
      if (toInsert.length > 0) {
        await db.insert(files).values(toInsert);
        projectFiles = await db.select().from(files).where(eq(files.projectId, projectId));
      }
    }

    if (projectFiles.length === 0) {
      return NextResponse.json({ error: "No files to deploy" }, { status: 400 })
    }

    const subdomain = projectId.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    const baseDomain = process.env.NODE_ENV === "development" ? "lvh.me" : (process.env.NEXT_PUBLIC_BASE_DOMAIN || "falbor.xyz")
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https"
    const port = process.env.NODE_ENV === "development" ? ":3000" : ""
    const deploymentUrl = `${protocol}://${subdomain}.${baseDomain}${port}`

    const [existingDeployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectId))
      .limit(1)

    if (existingDeployment) {
      await db
        .update(deployments)
        .set({
          deploymentUrl,
          subdomain,
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, existingDeployment.id))

      return NextResponse.json({
        deploymentUrl,
        isNewDeployment: false,
      })
    }

    const [newDeployment] = await db
      .insert(deployments)
      .values({
        projectId,
        deploymentUrl,
        subdomain,
        isPublic: true,
        showBranding: true,
      })
      .returning()

    return NextResponse.json({
      deploymentUrl,
      isNewDeployment: true,
      deployment: newDeployment,
    })
  } catch (error) {
    console.error("[DEPLOY]", error)
    return NextResponse.json({ error: "Failed to deploy project" }, { status: 500 })
  }
}