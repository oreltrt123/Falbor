import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Octokit } from '@octokit/core';
import { db } from '@/config/db';
import { eq } from 'drizzle-orm';
import { userGithubConnections, files, projects } from "@/config/schema";

export async function POST(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  const { repoName } = await req.json();

  if (!repoName) {
    return NextResponse.json({ error: 'Repo name required' }, { status: 400 });
  }

  const [connection] = await db
    .select()
    .from(userGithubConnections)
    .where(eq(userGithubConnections.userId, userId));

  if (!connection) {
    return NextResponse.json({ error: 'No GitHub connection' }, { status: 404 });
  }

  const octokit = new Octokit({ auth: connection.accessToken });

  try {
    // 1. Create new GitHub repo
    const { data: repo } = await octokit.request('POST /user/repos', {
      name: repoName,
      private: false,
    });

    // 2. Fetch project files from DB
    const projectFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId));

    if (!projectFiles.length) {
      return NextResponse.json({ error: 'No files to push' }, { status: 400 });
    }

    // 3. Create blobs
    const blobPromises = projectFiles.map((file) =>
      octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner: connection.githubUsername!,
        repo: repoName,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      })
    );

    const blobs = await Promise.all(blobPromises);

    // 4. Create tree (FIXED TYPES)
    const tree = projectFiles.map((file, index) => ({
      path: file.path,
      mode: '100644' as '100644',
      type: 'blob' as 'blob',
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

    // 5. Create commit
    const { data: commit } = await octokit.request(
      'POST /repos/{owner}/{repo}/git/commits',
      {
        owner: connection.githubUsername!,
        repo: repoName,
        message: 'Initial commit from YourSite',
        tree: treeData.sha,
      }
    );

    // 6. Create main branch
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner: connection.githubUsername!,
      repo: repoName,
      ref: 'refs/heads/main',
      sha: commit.sha,
    });

    const repoUrl = repo.html_url;

    // 7. Save GitHub URL to project
    await db
      .update(projects)
      .set({ githubUrl: repoUrl })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ repoUrl });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || 'Failed to push to GitHub' },
      { status: 500 }
    );
  }
}
