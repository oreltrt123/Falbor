// api/projects/id 
// No changes needed - this handles model updates independently of the preview/sandbox.
import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { projects } from "@/config/schema"
import { eq, and } from "drizzle-orm"
import type { NextRequest } from "next/server"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { id: projectId } = await params  // Await params and destructure id

  try {
    const body = await request.json()
    const { selectedModel } = body

    if (!selectedModel) {
      return new Response(JSON.stringify({ error: "Missing selectedModel" }), { status: 400 })
    }

    await db
      .update(projects)
      .set({ selectedModel, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("[API/Projects/Update] Error:", error)
    return new Response(JSON.stringify({ error: "Failed to update project" }), { status: 500 })
  }
}







// import { auth } from "@clerk/nextjs/server"
// import { db } from "@/config/db"
// import { projects } from "@/config/schema"
// import { eq, and } from "drizzle-orm"
// import type { NextRequest } from "next/server"

// export async function GET(request: Request, { params }: { params: { id: string } }) {
//   const { userId } = await auth()

//   if (!userId) {
//     return new Response(JSON.stringify({ error: "Unauthorized" }), {
//       status: 401,
//       headers: { "Content-Type": "application/json" },
//     })
//   }

//   const projectId = params.id

//   try {
//     const [project] = await db
//       .select()
//       .from(projects)
//       .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

//     // Debug log (remove in production)
//     console.log("[API/Projects/GET] Queried for ID:", projectId, "User:", userId, "Result:", project ? "Found" : "Not found")

//     if (!project) {
//       return new Response(JSON.stringify({ error: "Project not found" }), {
//         status: 404,
//         headers: { "Content-Type": "application/json" },
//       })
//     }

//     return new Response(JSON.stringify({ project }), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     })
//   } catch (error) {
//     console.error("[API/Projects/GET] Error:", error)
//     return new Response(JSON.stringify({ error: "Failed to fetch project" }), {
//       status: 500,
//       headers: { "Content-Type": "application/json" },
//     })
//   }
// }

// export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
//   const { userId } = await auth()

//   if (!userId) {
//     return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
//   }

//   const projectId = params.id

//   try {
//     const body = await request.json()
//     const { selectedModel } = body

//     if (!selectedModel) {
//       return new Response(JSON.stringify({ error: "Missing selectedModel" }), { status: 400 })
//     }

//     await db
//       .update(projects)
//       .set({ selectedModel, updatedAt: new Date() })
//       .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))

//     return new Response(JSON.stringify({ success: true }), { status: 200 })
//   } catch (error) {
//     console.error("[API/Projects/Update] Error:", error)
//     return new Response(JSON.stringify({ error: "Failed to update project" }), { status: 500 })
//   }
// }