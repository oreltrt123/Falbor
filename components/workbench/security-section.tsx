"use client"

import { useState, useEffect } from "react"
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, Eye, FileCode, Activity } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface SecuritySectionProps {
  projectId: string
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

interface SecurityIssue {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  file: string
  line?: number
  recommendation: string
}

interface SecurityLog {
  id: string
  timestamp: string
  level: "info" | "warning" | "error"
  message: string
  details?: string
}

export function SecuritySection({ projectId }: SecuritySectionProps) {
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<SecurityScan | null>(null)
  const [logs, setLogs] = useState<SecurityLog[]>([])

  useEffect(() => {
    // Load previous scan results and logs
    loadSecurityData()
  }, [projectId])

  const loadSecurityData = async () => {
    try {
      const response = await fetch(`/api/security/scan?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setLastScan(data.lastScan)
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error("[v0] Failed to load security data:", error)
    }
  }

  const runSecurityScan = async () => {
    setScanning(true)

    try {
      const response = await fetch("/api/security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        throw new Error("Security scan failed")
      }

      const result = await response.json()
      setLastScan(result.scan)
      setLogs(result.logs || [])

      // Add success log
      addLog("info", "Security scan completed successfully")
    } catch (error) {
      console.error("[v0] Security scan error:", error)
      addLog("error", "Security scan failed", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setScanning(false)
    }
  }

  const addLog = (level: "info" | "warning" | "error", message: string, details?: string) => {
    const newLog: SecurityLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    }
    setLogs((prev) => [newLog, ...prev])
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500 text-white"
      case "high":
        return "bg-orange-500 text-white"
      case "medium":
        return "bg-yellow-500 text-black"
      case "low":
        return "bg-blue-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  return (
    <div className="p-2 flex-1 m-0 flex flex-col overflow-hidden">
      {/* Main Project Title */}
      <div className="mb-4 flex justify-between items-center w-full">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            App & web Security
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure row-level security policies to control who can access your app & web data
          </p>
        </div>
      </div>

      {/* Security Overview */}
      {lastScan && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{lastScan.vulnerabilities.critical}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">High</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{lastScan.vulnerabilities.high}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Medium</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-500">{lastScan.vulnerabilities.medium}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Low</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">{lastScan.vulnerabilities.low}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for Issues and Logs */}
      <Tabs defaultValue="issues" className="w-full flex-1">
        <button
         onClick={runSecurityScan}
         disabled={scanning}
         className={cn(
            "flex items-center gap-1 text-sm px-2 py-1 w-39 rounded transition-colors cursor-pointer bg-[#2b2525] hover:bg-[#2b2525ce] text-white"
         )}
          >
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Run Security Scan"}
        </button>
        <TabsList className="justify-start bg-transparent">
          <TabsTrigger value="issues" className="gap-2 text-black">
            <AlertTriangle className="h-4 w-4" />
            Security Issues
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 text-black">
            <Activity className="h-4 w-4" />
            Security Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="h-full mt-4">
          {!lastScan ? (
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertTitle>No scan data available</AlertTitle>
              <AlertDescription>
                Click "Run Security Scan" to analyze your project files for vulnerabilities.
              </AlertDescription>
            </Alert>
          ) : lastScan.issues.length === 0 ? (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">No issues found!</AlertTitle>
              <AlertDescription className="text-green-600">
                Your project passed the security scan with no vulnerabilities detected.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[calc(100%-2rem)] w-full pr-4">
              <div className="space-y-4">
                {lastScan.issues.map((issue) => (
                  <Card key={issue.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(issue.severity)}>{issue.severity.toUpperCase()}</Badge>
                            <CardTitle className="text-base">{issue.title}</CardTitle>
                          </div>
                          <CardDescription className="flex items-center gap-2">
                            <FileCode className="h-3 w-3" />
                            {issue.file}
                            {issue.line && ` (Line ${issue.line})`}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Description:</h4>
                        <p className="text-sm text-muted-foreground">{issue.description}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Recommendation:</h4>
                        <p className="text-sm text-muted-foreground">{issue.recommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="logs" className="h-full mt-4">
          <ScrollArea className="h-[calc(100%-2rem)] w-full pr-4">
            <div className="space-y-2">
              {logs.length === 0 ? (
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertTitle>No logs available</AlertTitle>
                  <AlertDescription>Security logs will appear here after running scans.</AlertDescription>
                </Alert>
              ) : (
                logs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {getLogIcon(log.level)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{log.message}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {log.details && <p className="text-xs text-muted-foreground">{log.details}</p>}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}