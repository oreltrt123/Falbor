import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from '@clerk/nextjs/server'
import { Octokit } from '@octokit/core'
import { db } from '@/config/db' // Your Drizzle DB instance
import { userGithubConnections } from '@/config/schema'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const code = req.query.code as string
  const state = req.query.state as string
  const redirectTo = decodeURIComponent(state) || '/projects'

  if (!code) {
    return res.status(400).json({ error: 'No code provided' })
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.access_token

  if (!accessToken) {
    return res.status(400).json({ error: 'Failed to get access token' })
  }

  // Get GitHub username
  const octokit = new Octokit({ auth: accessToken })
  const { data: userData } = await octokit.request('GET /user')
  const githubUsername = userData.login

  // Store in DB (upsert)
  await db.insert(userGithubConnections).values({
    userId,
    accessToken,
    githubUsername,
  }).onConflictDoUpdate({
    target: userGithubConnections.userId,
    set: { accessToken, githubUsername, updatedAt: new Date() },
  })

  res.redirect(redirectTo)
}