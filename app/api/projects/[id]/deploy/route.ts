// app/api/projects/[id]/deploy/route.ts
// Full corrected file with proper Clerk authentication for Bearer token (session token)
// Uses auth({ acceptsToken: 'session_token' }) which is the recommended way in Next.js App Router for verifying manual Bearer tokens.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/config/db'
import { deployments, projects, files } from '@/config/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify the session token sent as Bearer (manual JWT verification)
    const { userId } = await auth({ acceptsToken: 'session_token' })

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all project files to ensure there's something to deploy
    const projectFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId))

    if (projectFiles.length === 0) {
      return NextResponse.json({ error: 'No files to deploy' }, { status: 400 })
    }

    // Generate subdomain
    const subdomain = projectId.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000'
      : `https://${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'falbor.xyz'}`
    
    const deploymentUrl = process.env.NODE_ENV === 'development'
      ? `${baseUrl}/deploy/${subdomain}`
      : `https://${subdomain}.${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'falbor.xyz'}`

    // Optional Vercel integration (skip if not configured)
    let finalDeploymentUrl = deploymentUrl
    if (project.deploymentConfig?.platform === 'vercel' && project.deploymentConfig.apiKey) {
      // Vercel logic here (as before, but it's optional and can be removed if not needed)
      // For now, fallback to local
      console.warn('Vercel deployment not fully implemented')
    }

    // Check existing deployment
    const [existingDeployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectId))
      .limit(1)

    if (existingDeployment) {
      await db
        .update(deployments)
        .set({
          deploymentUrl: finalDeploymentUrl,
          subdomain,
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, existingDeployment.id))

      return NextResponse.json({
        deploymentUrl: finalDeploymentUrl,
        isNewDeployment: false,
      })
    }

    // Create new deployment
    const [newDeployment] = await db
      .insert(deployments)
      .values({
        projectId,
        deploymentUrl: finalDeploymentUrl,
        subdomain,
        isPublic: true,
        showBranding: true,
      })
      .returning()

    return NextResponse.json({
      deploymentUrl: finalDeploymentUrl,
      isNewDeployment: true,
      deployment: newDeployment,
    })
  } catch (error) {
    console.error('[v0] Deploy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deploy project' },
      { status: 500 }
    )
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth({ acceptsToken: 'session_token' })

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectId))
      .limit(1)

    if (!deployment) {
      return NextResponse.json({ error: 'No deployment found' }, { status: 404 })
    }

    return NextResponse.json({ deployment })
  } catch (error) {
    console.error('[v0] Get deployment error:', error)
    return NextResponse.json(
      { error: 'Failed to get deployment' },
      { status: 500 }
    )
  }
}