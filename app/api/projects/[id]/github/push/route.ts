// app/api/projects/[id]/github/push/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { Octokit } from "@octokit/core";
import { db } from "@/config/db";
import { eq } from "drizzle-orm";
import { userGithubConnections, files, projects } from "@/config/schema";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // IMPORTANT: params is a Promise in Next.js App Router
  const { id: projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  let repoName: string;

  try {
    const body = await req.json();
    repoName = body.repoName;

    if (!repoName || typeof repoName !== "string") {
      return NextResponse.json({ error: "Valid repo name required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Get GitHub connection
  const [connection] = await db
    .select()
    .from(userGithubConnections)
    .where(eq(userGithubConnections.userId, userId));

  if (!connection?.accessToken || !connection.githubUsername) {
    return NextResponse.json({ error: "No valid GitHub connection found" }, { status: 404 });
  }

  const octokit = new Octokit({ auth: connection.accessToken });

  try {
    // 1. Create repo
    const { data: repo } = await octokit.request("POST /user/repos", {
      name: repoName,
      private: false,
      auto_init: false,
    });

    // 2. Get project files
    const projectFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId));

    if (!projectFiles.length) {
      return NextResponse.json({ error: "No files to push" }, { status: 400 });
    }

    // 3. Create blobs
    const blobs = await Promise.all(
      projectFiles.map((file) =>
        octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
          owner: connection.githubUsername!,
          repo: repoName,
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        })
      )
    );

    // 4. Build tree
    const tree = projectFiles.map((file, i) => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blobs[i].data.sha,
    }));

    const { data: treeData } = await octokit.request(
      "POST /repos/{owner}/{repo}/git/trees",
      {
        owner: connection.githubUsername!,
        repo: repoName,
        tree,
      }
    );

    // 5. Create commit
    const { data: commit } = await octokit.request(
      "POST /repos/{owner}/{repo}/git/commits",
      {
        owner: connection.githubUsername!,
        repo: repoName,
        message: "Initial commit from YourSite",
        tree: treeData.sha,
      }
    );

    // 6. Create main branch
    await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
      owner: connection.githubUsername!,
      repo: repoName,
      ref: "refs/heads/main",
      sha: commit.sha,
    });

    // 7. Save repo URL
    await db
      .update(projects)
      .set({ githubUrl: repo.html_url })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ success: true, repoUrl: repo.html_url });
  } catch (error: any) {
    console.error("GitHub push error:", error);
    return NextResponse.json(
      { error: error?.response?.data?.message || "Failed to push to GitHub" },
      { status: 500 }
    );
  }
}
