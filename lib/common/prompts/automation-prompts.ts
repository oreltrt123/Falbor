import { generateText } from "ai"

/**
 * Generate unique, AI-created project ideas dynamically
 * Each call creates a completely different idea using the AI
 */
export async function generateAIAutomationPrompt(model: string = "gemini"): Promise<string> {
  try {
    const { text } = await generateText({
      model: model === "gemini" ? "google/gemini-2.0-flash" : 
             model === "claude" ? "anthropic/claude-sonnet-4.5" :
             model === "gpt" ? "openai/gpt-4-mini" :
             model === "deepseek" ? "deepseek/deepseek-r1" : "google/gemini-2.0-flash",
      
      system: `You are an innovative web project ideation assistant. Your job is to generate completely unique, creative web application ideas that users can build with code.
      
Requirements:
- Generate ONE single project idea (not a list)
- The idea must be novel, specific, and actionable
- Include concrete details about what the app does, who it helps, and key features
- Keep it under 150 words
- Format: Start with the app name, then describe what it does and why it's cool
- Make each idea different - never repeat categories or concepts`,
      
      prompt: `Generate a brand new, creative web application idea that would be fun to build. Make it specific, unique, and implementable. Today is ${new Date().toLocaleDateString()}.`,
    })
    
    return text
  } catch (err) {
    console.error("[AI Prompt Generation] Error:", err)
    // Fallback if AI generation fails
    return generateFallbackPrompt()
  }
}

/**
 * Fallback prompts if AI generation fails
 */
function generateFallbackPrompt(): string {
  const categories = ["productivity", "social", "education", "entertainment", "health", "commerce", "community"]
  const adjectives = ["innovative", "minimal", "collaborative", "real-time", "decentralized", "interactive", "smart"]
  
  const randomCategory = categories[Math.floor(Math.random() * categories.length)]
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const randomId = Math.random().toString(36).substring(7)
  
  const fallbackPrompts = [
    `Build a ${randomAdj} ${randomCategory} web app (ID: ${randomId}). Create something unique that solves a real problem in the ${randomCategory} space. Make it interactive and production-ready.`,
    `Today's challenge: Create a ${randomAdj} web application for ${randomCategory}. From concept to working prototype - design it, build it, and make it look polished.`,
    `Autonomous AI project: Develop a new ${randomAdj}} approach to ${randomCategory}}. Build a full-featured web app with a great UX. Make it live and functional.`,
  ]
  
  return fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)]
}

/**
 * Generate follow-up prompts for multi-turn conversations
 */
export async function generateFollowUpPrompt(turnNumber: number, model: string = "gemini"): Promise<string> {
  try {
    const { text } = await generateText({
      model: model === "gemini" ? "google/gemini-2.0-flash" : 
             model === "claude" ? "anthropic/claude-sonnet-4.5" :
             model === "gpt" ? "openai/gpt-4-mini" :
             model === "deepseek" ? "deepseek/deepseek-r1" : "google/gemini-2.0-flash",
      
      system: `You are a development coach helping iterate on a web project. Generate ONE specific, actionable next step that improves the project.
      
Requirements:
- Keep it to 1-2 sentences
- Be specific about what to implement
- Make it different each time`,
      
      prompt: `Generate step ${turnNumber} to improve this web project. Give a specific enhancement suggestion like adding features, improving UX, or integrating a service.`,
    })
    
    return text
  } catch (err) {
    console.error("[Follow-up Prompt Generation] Error:", err)
    return generateFallbackFollowUp(turnNumber)
  }
}

/**
 * Fallback follow-up prompts
 */
function generateFallbackFollowUp(turnNumber: number): string {
  const followUps = [
    "Add user authentication and a personalized dashboard.",
    "Create a responsive mobile design and test on various devices.",
    "Integrate a real API or database for dynamic content.",
    "Implement advanced search, filtering, and sorting features.",
    "Add real-time notifications and live updates.",
    "Create an admin panel with data analytics.",
    "Optimize performance and implement caching strategies.",
    "Add social sharing and collaboration features.",
    "Deploy to production and set up monitoring.",
    "Implement user feedback and analytics tracking.",
  ]
  
  return followUps[turnNumber % followUps.length]
}
