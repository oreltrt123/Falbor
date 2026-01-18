import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from '@clerk/nextjs/server'
import { Octokit } from '@octokit/core'
import { db } from '@/config/db'
import { eq } from 'drizzle-orm'
import { userGithubConnections } from "@/config/schema"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const [connection] = await db.select().from(userGithubConnections).where(eq(userGithubConnections.userId, userId))
  if (!connection) return res.status(404).json({ error: 'No GitHub connection' })

  const octokit = new Octokit({ auth: connection.accessToken })
  try {
    const { data: repos } = await octokit.request('GET /user/repos', { type: 'owner' })
    res.json({ repos })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repos' })
  }
}