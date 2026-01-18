import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from '@clerk/nextjs/server'
import { db } from '@/config/db'
import { eq } from 'drizzle-orm' // Adjust imports
import { userGithubConnections } from "@/config/schema"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const connection = await db.select().from(userGithubConnections).where(eq(userGithubConnections.userId, userId)).limit(1)
  res.json({ connected: !!connection.length })
}