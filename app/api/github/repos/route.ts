import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Octokit } from '@octokit/core';
import { db } from '@/config/db';
import { eq } from 'drizzle-orm';
import { userGithubConnections } from "@/config/schema";

export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [connection] = await db.select().from(userGithubConnections).where(eq(userGithubConnections.userId, userId));
  if (!connection) return NextResponse.json({ error: 'No GitHub connection' }, { status: 404 });

  const octokit = new Octokit({ auth: connection.accessToken });
  try {
    const { data: repos } = await octokit.request('GET /user/repos', { type: 'owner' });
    return NextResponse.json({ repos });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch repos' }, { status: 500 });
  }
}