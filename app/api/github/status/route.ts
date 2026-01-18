import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { db } from '@/config/db';
import { eq } from 'drizzle-orm'; // Adjust imports
import { userGithubConnections } from "@/config/schema";

export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await db.select().from(userGithubConnections).where(eq(userGithubConnections.userId, userId)).limit(1);
  return NextResponse.json({ connected: !!connection.length });
}