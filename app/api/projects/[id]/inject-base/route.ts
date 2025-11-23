// app/api/projects/[id]/inject-base/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ... your auth check code here

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Note: Promise<> for Next.js 15+ compatibility
) {
  const { id } = await params; // Await to resolve the Promise

  const baseFiles = [ /* array of { path, content, language } from below */ ];
  // Loop and upsert each to your files table/storage
  // e.g., for each: await db.projectFiles.upsert({ where: { path_projectId: id + '/' + path }, update: { content }, create: { ... } })
  
  return NextResponse.json({ success: true });
}