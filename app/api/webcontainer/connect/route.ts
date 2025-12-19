import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  console.log("Server received:", body);
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json({ success: false, error: "No projectId" }, { status: 400 });
  }

  // TODO: insert real logic to connect project using projectId

  return NextResponse.json({ success: true });
}
