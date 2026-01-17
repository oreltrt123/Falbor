// Updated User login endpoint for generated sites
import { db } from "@/config/db"
import { projectUsers, projectLogs } from "@/config/schema"
import { eq, and } from "drizzle-orm"
import { createHash, randomBytes } from "crypto"
import { getOrCreateProjectDatabase } from "@/config/db"  // Assuming this is the correct import path based on code 3

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400 })
    }

    const database = await getOrCreateProjectDatabase(projectId)

    // Find user
    const [user] = await db
      .select()
      .from(projectUsers)
      .where(and(eq(projectUsers.projectDatabaseId, database.id), eq(projectUsers.email, email.toLowerCase())))
      .limit(1)

    if (!user) {
      await db.insert(projectLogs).values({
        projectId,
        level: "warn",
        message: `Login failed: User not found - ${email}`,
      })

      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 })
    }

    // Verify password
    const [salt, storedHash] = user.passwordHash.split(":")
    const passwordHash = createHash("sha256")
      .update(password + salt)
      .digest("hex")

    if (passwordHash !== storedHash) {
      await db.insert(projectLogs).values({
        projectId,
        level: "warn",
        message: `Login failed: Invalid password - ${email}`,
      })

      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 })
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString("hex")

    // Log login
    await db.insert(projectLogs).values({
      projectId,
      level: "success",
      message: `User logged in: ${email}`,
      details: { userId: user.id },
    })

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token: sessionToken,
      }),
      {
        status: 200,
        headers: {
          "Set-Cookie": `project_session_${projectId}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
        },
      },
    )
  } catch (error) {
    console.error("[Auth/Login] Error:", error)
    return new Response(JSON.stringify({ error: "Login failed" }), { status: 500 })
  }
}