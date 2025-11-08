"use client"

interface ImprovePromptResult {
  improvedPrompt: string
}

/**
 * Calls the backend to improve the prompt.
 * Returns the improved text (or throws).
 */
export async function improvePrompt(projectId: string, prompt: string): Promise<string> {
  const res = await fetch("/api/chat/improve-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, prompt }),
  })

  if (!res.ok) throw new Error("Failed to improve prompt")
  const data = (await res.json()) as ImprovePromptResult
  return data.improvedPrompt
}