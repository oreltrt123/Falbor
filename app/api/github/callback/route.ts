import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Octokit } from '@octokit/core';
import { db } from '@/config/db'; // Your Drizzle DB instance
import { userGithubConnections } from '@/config/schema';

export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const redirectTo = state ? decodeURIComponent(state) : '/projects';

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
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
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return NextResponse.json({ error: 'Failed to get access token' }, { status: 400 });
  }

  // Get GitHub username
  const octokit = new Octokit({ auth: accessToken });
  const { data: userData } = await octokit.request('GET /user');
  const githubUsername = userData.login;

  // Store in DB (upsert)
  await db.insert(userGithubConnections).values({
    userId,
    accessToken,
    githubUsername,
  }).onConflictDoUpdate({
    target: userGithubConnections.userId,
    set: { accessToken, githubUsername, updatedAt: new Date() },
  });

  return NextResponse.redirect(redirectTo);
}