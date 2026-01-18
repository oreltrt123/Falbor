// app/api/projects/[projectId]/github/push/route.ts
// IMPORTANT: Make sure this file is EXACTLY in this folder structure!
// If it's not, Next.js won't recognize it as a dynamic route, and params.projectId will be undefined.
// After moving/creating the file, RESTART your dev server (ctrl+c then npm run dev/yarn dev/etc.)

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Octokit } from '@octokit/core';
import { db } from '@/config/db';
import { eq } from 'drizzle-orm';
import { userGithubConnections, files, projects } from "@/config/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Now we get projectId from the dynamic route segment
  const projectId = params.projectId;

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  let repoName: string;
  try {
    const body = await req.json();
    repoName = body.repoName;

    if (!repoName || typeof repoName !== 'string' || repoName.trim() === '') {
      return NextResponse.json({ error: 'Valid repo name required' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Get GitHub connection
  const [connection] = await db
    .select()
    .from(userGithubConnections)
    .where(eq(userGithubConnections.userId, userId));

  if (!connection?.accessToken || !connection.githubUsername) {
    return NextResponse.json({ error: 'No valid GitHub connection found' }, { status: 404 });
  }

  const octokit = new Octokit({ auth: connection.accessToken });

  try {
    // 1. Create new GitHub repository
    const { data: repo } = await octokit.request('POST /user/repos', {
      name: repoName,
      private: false,
      auto_init: false,           // we don't want README etc.
    });

    // 2. Get all project files
    const projectFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId));

    if (!projectFiles.length) {
      return NextResponse.json({ error: 'No files to push' }, { status: 400 });
    }

    // 3. Create blobs for each file
    const blobPromises = projectFiles.map((file) =>
      octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner: connection.githubUsername!,
        repo: repoName,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      })
    );

    const blobs = await Promise.all(blobPromises);

    // 4. Build git tree
    const tree = projectFiles.map((file, index) => ({
      path: file.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blobs[index].data.sha,
    }));

    const { data: treeData } = await octokit.request(
      'POST /repos/{owner}/{repo}/git/trees',
      {
        owner: connection.githubUsername!,
        repo: repoName,
        tree,
      }
    );

    // 5. Create the commit
    const { data: commit } = await octokit.request(
      'POST /repos/{owner}/{repo}/git/commits',
      {
        owner: connection.githubUsername!,
        repo: repoName,
        message: 'Initial commit from YourSite',
        tree: treeData.sha,
      }
    );

    // 6. Create the main branch
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner: connection.githubUsername!,
      repo: repoName,
      ref: 'refs/heads/main',
      sha: commit.sha,
    });

    const repoUrl = repo.html_url;

    // 7. Save the repo URL to project
    await db
      .update(projects)
      .set({ githubUrl: repoUrl })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ success: true, repoUrl });
  } catch (error: any) {
    console.error('GitHub push error:', error);
    const message = error?.response?.data?.message || error.message || 'Failed to push to GitHub';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}