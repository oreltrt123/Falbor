import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/config/db"
import { files } from "@/config/schema"
import { eq } from "drizzle-orm"

interface SecurityIssue {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  file: string
  line?: number
  recommendation: string
}

interface SecurityScan {
  id: string
  timestamp: string
  status: "completed" | "running" | "failed"
  vulnerabilities: {
    critical: number
    high: number
    medium: number
    low: number
  }
  issues: SecurityIssue[]
}

interface SecurityLog {
  id: string
  timestamp: string
  level: "info" | "warning" | "error"
  message: string
  details?: string
}

// Security patterns to detect
const SECURITY_PATTERNS = [
  {
    pattern: /(password|secret|api[_-]?key|token)\s*=\s*["'][^"']+["']/gi,
    severity: "critical" as const,
    title: "Hardcoded Credentials Detected",
    description: "Found hardcoded credentials or API keys in the source code",
    recommendation: "Use environment variables to store sensitive information instead of hardcoding them",
  },
  {
    pattern: /eval\s*\(/gi,
    severity: "high" as const,
    title: "Use of eval() Function",
    description: "The eval() function can execute arbitrary code and is a security risk",
    recommendation: "Avoid using eval(). Use safer alternatives like JSON.parse() for data parsing",
  },
  {
    pattern: /dangerouslySetInnerHTML/gi,
    severity: "high" as const,
    title: "Dangerous HTML Injection",
    description: "Using dangerouslySetInnerHTML can lead to XSS attacks",
    recommendation: "Sanitize user input or use safer React rendering methods",
  },
  {
    pattern: /innerHTML\s*=/gi,
    severity: "medium" as const,
    title: "Direct HTML Manipulation",
    description: "Direct innerHTML manipulation can be vulnerable to XSS attacks",
    recommendation: "Use textContent or DOM methods, and sanitize any user input",
  },
  {
    pattern: /document\.write/gi,
    severity: "medium" as const,
    title: "Use of document.write()",
    description: "document.write() can be exploited for XSS attacks",
    recommendation: "Use modern DOM manipulation methods instead",
  },
  {
    pattern: /localStorage\.(setItem|getItem)/gi,
    severity: "low" as const,
    title: "Sensitive Data in localStorage",
    description: "localStorage is not encrypted and can be accessed by any script",
    recommendation:
      "Avoid storing sensitive data in localStorage. Use secure, HTTP-only cookies for sensitive information",
  },
  {
    pattern: /process\.env\./gi,
    severity: "low" as const,
    title: "Environment Variable Usage",
    description: "Environment variables detected. Ensure they are not exposed to the client",
    recommendation: "Only use NEXT_PUBLIC_ prefixed variables on the client side",
  },
]

// Analyze file content for security issues
function analyzeFileContent(content: string, filePath: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []

  SECURITY_PATTERNS.forEach((pattern) => {
    const matches = content.matchAll(pattern.pattern)

    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split("\n").length

      issues.push({
        id: `${filePath}-${lineNumber}-${pattern.title}`,
        severity: pattern.severity,
        title: pattern.title,
        description: pattern.description,
        file: filePath,
        line: lineNumber,
        recommendation: pattern.recommendation,
      })
    }
  })

  return issues
}

// Analyze dependencies (simulated - in production, integrate with Snyk API)
async function analyzeDependencies(projectId: string): Promise<SecurityIssue[]> {
  // Get Snyk API key from server environment
  const snykApiKey = process.env.SNYK_API_KEY

  const issues: SecurityIssue[] = []

  if (snykApiKey) {
    try {
      console.log("[v0] Using Snyk API for dependency scanning...")

      // Fetch package.json from project files
      const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId))
      const packageJsonFile = projectFiles.find((f) => f.path === "package.json")

      if (packageJsonFile) {
        const packageJson = JSON.parse(packageJsonFile.content)

        // Call Snyk API to test dependencies
        const response = await fetch("https://api.snyk.io/v1/test/npm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `token ${snykApiKey}`,
          },
          body: JSON.stringify({
            encoding: "plain",
            package: packageJson,
          }),
        })

        if (response.ok) {
          const snykResults = await response.json()

          // Parse Snyk results and convert to our format
          if (snykResults.issues?.vulnerabilities) {
            snykResults.issues.vulnerabilities.forEach((vuln: any) => {
              issues.push({
                id: vuln.id,
                severity: vuln.severity as "critical" | "high" | "medium" | "low",
                title: `Dependency Vulnerability: ${vuln.title}`,
                description: vuln.description || "Known vulnerability in dependency",
                file: "package.json",
                recommendation: vuln.fixedIn
                  ? `Update to version ${vuln.fixedIn.join(", ")}`
                  : "Review and update the affected package",
              })
            })
          }
        }
      }
    } catch (error) {
      console.error("[v0] Snyk API error:", error)
      // Continue with local analysis even if Snyk fails
    }
  } else {
    console.log("[v0] No Snyk API key found - skipping dependency scanning")
  }

  return issues
}

// GET: Retrieve last scan results
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    // For now, return empty results (you can extend this to store scans in database)
    return NextResponse.json({
      lastScan: null,
      logs: [],
    })
  } catch (error) {
    console.error("[v0] Security scan GET error:", error)
    return NextResponse.json({ error: "Failed to retrieve security data" }, { status: 500 })
  }
}

// POST: Run security scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    const logs: SecurityLog[] = []

    // Log scan start
    logs.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Security scan initiated",
      details: `Scanning project ${projectId}`,
    })

    // Fetch all project files
    const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId))

    logs.push({
      id: (Date.now() + 1).toString(),
      timestamp: new Date().toISOString(),
      level: "info",
      message: `Analyzing ${projectFiles.length} files`,
    })

    // Analyze each file for security issues
    const allIssues: SecurityIssue[] = []

    for (const file of projectFiles) {
      const fileIssues = analyzeFileContent(file.content, file.path)
      allIssues.push(...fileIssues)

      if (fileIssues.length > 0) {
        logs.push({
          id: (Date.now() + allIssues.length).toString(),
          timestamp: new Date().toISOString(),
          level: "warning",
          message: `Found ${fileIssues.length} issue(s) in ${file.path}`,
        })
      }
    }

    const dependencyIssues = await analyzeDependencies(projectId)
    allIssues.push(...dependencyIssues)

    // Count vulnerabilities by severity
    const vulnerabilities = {
      critical: allIssues.filter((i) => i.severity === "critical").length,
      high: allIssues.filter((i) => i.severity === "high").length,
      medium: allIssues.filter((i) => i.severity === "medium").length,
      low: allIssues.filter((i) => i.severity === "low").length,
    }

    // Create scan result
    const scan: SecurityScan = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      status: "completed",
      vulnerabilities,
      issues: allIssues,
    }

    // Final log
    logs.push({
      id: (Date.now() + 2).toString(),
      timestamp: new Date().toISOString(),
      level: allIssues.length > 0 ? "warning" : "info",
      message: `Scan completed: ${allIssues.length} total issues found`,
      details: `Critical: ${vulnerabilities.critical}, High: ${vulnerabilities.high}, Medium: ${vulnerabilities.medium}, Low: ${vulnerabilities.low}`,
    })

    return NextResponse.json({ scan, logs })
  } catch (error) {
    console.error("[v0] Security scan error:", error)
    return NextResponse.json(
      { error: "Security scan failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
