// Updated User signup endpoint for generated sites
import { db } from "@/config/db"
import { projectUsers, projectLogs } from "@/config/schema"
import { eq, and } from "drizzle-orm"
import { createHash, randomBytes } from "crypto"
import { getOrCreateProjectDatabase } from "@/config/db"  // Assuming this is the correct import path based on code 3

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400 })
    }

    const database = await getOrCreateProjectDatabase(projectId)

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(projectUsers)
      .where(and(eq(projectUsers.projectDatabaseId, database.id), eq(projectUsers.email, email.toLowerCase())))
      .limit(1)

    if (existingUser.length > 0) {
      return new Response(JSON.stringify({ error: "User already exists" }), { status: 409 })
    }

    // Hash password with salt
    const salt = randomBytes(16).toString("hex")
    const passwordHash = createHash("sha256")
      .update(password + salt)
      .digest("hex")

    // Create user
    const [newUser] = await db
      .insert(projectUsers)
      .values({
        projectDatabaseId: database.id,
        email: email.toLowerCase(),
        name: name || null,
        passwordHash: `${salt}:${passwordHash}`,
        role: "user",
      })
      .returning({
        id: projectUsers.id,
        email: projectUsers.email,
        name: projectUsers.name,
        role: projectUsers.role,
        createdAt: projectUsers.createdAt,
      })

    // Generate session token
    const sessionToken = randomBytes(32).toString("hex")

    // Log signup
    await db.insert(projectLogs).values({
      projectId,
      level: "success",
      message: `User signed up: ${email}`,
      details: { userId: newUser.id },
    })

    return new Response(
      JSON.stringify({
        success: true,
        user: newUser,
        token: sessionToken,
      }),
      {
        status: 201,
        headers: {
          "Set-Cookie": `project_session_${projectId}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
        },
      },
    )
  } catch (error) {
    console.error("[Auth/Signup] Error:", error)

    await db.insert(projectLogs).values({
      projectId,
      level: "error",
      message: "Signup failed",
      details: { error: String(error) },
    })

    return new Response(JSON.stringify({ error: "Signup failed" }), { status: 500 })
  }
}