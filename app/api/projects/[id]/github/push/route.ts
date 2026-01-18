import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from '@clerk/nextjs/server'
import { Octokit } from '@octokit/core'
import { db } from '@/config/db'
import { eq } from 'drizzle-orm'
import { userGithubConnections, files, projects } from "@/config/schema"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId } = getAuth(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const projectId = req.query.projectId as string
  const { repoName } = req.body

  if (!repoName) return res.status(400).json({ error: 'Repo name required' })

  const [connection] = await db.select().from(userGithubConnections).where(eq(userGithubConnections.userId, userId))
  if (!connection) return res.status(404).json({ error: 'No GitHub connection' })

  const octokit = new Octokit({ auth: connection.accessToken })

  try {
    // Create new repo
    const { data: repo } = await octokit.request('POST /user/repos', {
      name: repoName,
      private: false, // Or true if you want private
    })

    // Fetch project files from DB
    const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId))

    if (!projectFiles.length) return res.status(400).json({ error: 'No files to push' })

    // Create blobs for each file
    const blobPromises = projectFiles.map((file) =>
      octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner: connection.githubUsername!,
        repo: repoName,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      })
    )
    const blobs = await Promise.all(blobPromises)

    // Create tree with paths
    const tree = projectFiles.map((file, index) => ({
      path: file.path,
      mode: '100644', // Regular file
      type: 'blob',
      sha: blobs[index].data.sha,
    }))

    const { data: treeData } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
      owner: connection.githubUsername!,
      repo: repoName,
      tree,
    })

    // Create initial commit
    const { data: commit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
      owner: connection.githubUsername!,
      repo: repoName,
      message: 'Initial commit from YourSite',
      tree: treeData.sha,
    })

    // Set ref to main
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner: connection.githubUsername!,
      repo: repoName,
      ref: 'refs/heads/main',
      sha: commit.sha,
    })

    const repoUrl = repo.html_url

    // Optionally update project.githubUrl
    await db.update(projects).set({ githubUrl: repoUrl }).where(eq(projects.id, projectId))

    res.json({ repoUrl })
  } catch (error: any) {
    console.error(error)
    res.status(500).json({ error: error.message || 'Failed to push to GitHub' })
  }
}