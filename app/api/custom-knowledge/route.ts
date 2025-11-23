import { auth } from "@clerk/nextjs/server"
import { db } from "@/config/db"
import { userCustomKnowledge } from "@/config/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [knowledge] = await db.select().from(userCustomKnowledge).where(eq(userCustomKnowledge.userId, userId))

    return NextResponse.json({ knowledge: knowledge || null })
  } catch (error) {
    console.error("[API/CustomKnowledge] GET error:", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { promptName, promptContent } = body

    if (!promptName || !promptContent) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if user already has custom knowledge
    const [existing] = await db.select().from(userCustomKnowledge).where(eq(userCustomKnowledge.userId, userId))

    if (existing) {
      // Update existing
      await db
        .update(userCustomKnowledge)
        .set({
          promptName,
          promptContent,
          updatedAt: new Date(),
        })
        .where(eq(userCustomKnowledge.userId, userId))
    } else {
      // Insert new
      await db.insert(userCustomKnowledge).values({
        userId,
        promptName,
        promptContent,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API/CustomKnowledge] POST error:", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
}
