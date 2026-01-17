"use client"

import { useCallback, useState, useEffect } from "react"
import {
  Users,
  Table2,
  Terminal,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Database,
  Key,
  Copy,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DatabasePanelProps {
  projectId: string
  supabaseCredentials?: { supabaseUrl: string; anonKey: string } | null
}

interface SupabaseUser {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  lastSignIn: string | null
}

interface TableColumn {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

interface TableInfo {
  name: string
  schema: string
  columns: TableColumn[]
}

interface LogEntry {
  id: string
  level: "info" | "warn" | "error" | "success"
  message: string
  details: Record<string, any> | null
  createdAt: string
}

type TabType = "users" | "tables" | "logs" | "credentials"

export function DatabasePanel({ projectId, supabaseCredentials }: DatabasePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("credentials")
  const [users, setUsers] = useState<SupabaseUser[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch users from Supabase (only if credentials exist)
  const fetchUsers = useCallback(async () => {
    if (!supabaseCredentials) return
    try {
      const res = await fetch(`/api/projects/${projectId}/supabase/users`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("[DatabasePanel] Users fetch error:", error)
    }
  }, [projectId, supabaseCredentials])

  // Fetch tables from Supabase (only if credentials exist)
  const fetchTables = useCallback(async () => {
    if (!supabaseCredentials) return
    try {
      const res = await fetch(`/api/projects/${projectId}/supabase/tables`)
      if (res.ok) {
        const data = await res.json()
        setTables(data.tables || [])
      }
    } catch (error) {
      console.error("[DatabasePanel] Tables fetch error:", error)
    }
  }, [projectId, supabaseCredentials])

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/database/logs?limit=100`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error("[DatabasePanel] Logs fetch error:", error)
    }
  }, [projectId])

  useEffect(() => {
    if (supabaseCredentials) {
      setLoading(true)
      Promise.all([fetchTables(), fetchUsers(), fetchLogs()]).finally(() => setLoading(false))
    }
  }, [supabaseCredentials, fetchTables, fetchUsers, fetchLogs])

  // Refresh based on active tab
  const refresh = useCallback(async () => {
    if (!supabaseCredentials && activeTab !== "logs") return
    setLoading(true)
    if (activeTab === "users") await fetchUsers()
    else if (activeTab === "tables") await fetchTables()
    else if (activeTab === "logs") await fetchLogs()
    setLoading(false)
  }, [activeTab, fetchUsers, fetchTables, fetchLogs, supabaseCredentials])

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Log level icon
  const getLogIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case "warn":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  return (
    <div className="flex-1 overflow-auto w-full bg-background">
      {/* Header with tabs */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("credentials")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "credentials" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            <Key className="w-4 h-4" />
            Credentials
          </button>
          <button
            onClick={() => setActiveTab("tables")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "tables" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            <Table2 className="w-4 h-4" />
            Tables
            {tables.length > 0 && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{tables.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "users" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            <Users className="w-4 h-4" />
            Users
            {users.length > 0 && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{users.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "logs" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            <Terminal className="w-4 h-4" />
            Logs
          </button>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto">
          {/* Credentials Tab */}
          {activeTab === "credentials" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Supabase Credentials</h3>
              </div>

              {supabaseCredentials ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Supabase Connected</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Your Supabase credentials have been configured.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">VITE_SUPABASE_URL</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono text-foreground break-all">
                          {supabaseCredentials.supabaseUrl}
                        </code>
                        <button
                          onClick={() => copyToClipboard(supabaseCredentials.supabaseUrl, "url")}
                          className="p-1.5 hover:bg-accent rounded"
                        >
                          {copiedField === "url" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        VITE_SUPABASE_ANON_KEY
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono text-foreground break-all">
                          {supabaseCredentials.anonKey.substring(0, 20)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(supabaseCredentials.anonKey, "key")}
                          className="p-1.5 hover:bg-accent rounded"
                        >
                          {copiedField === "key" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      These credentials are automatically injected into your .env file for the preview.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">No Supabase Credentials</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Enter your Supabase credentials when the AI prompts you during the build process.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tables Tab */}
          {activeTab === "tables" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Database Tables</h3>
                <span className="text-xs text-muted-foreground">From Supabase</span>
              </div>

              {!supabaseCredentials ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Table2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Connect Supabase first</p>
                  <p className="text-xs text-muted-foreground mt-1">Provide your Supabase credentials to view tables</p>
                </div>
              ) : tables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Table2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tables yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tables will appear when the AI creates SQL migrations
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tables.map((table) => (
                    <div
                      key={table.name}
                      onClick={() => setSelectedTable(selectedTable?.name === table.name ? null : table)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedTable?.name === table.name
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Table2 className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{table.name}</span>
                        </div>
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform",
                            selectedTable?.name === table.name && "rotate-90",
                          )}
                        />
                      </div>

                      {selectedTable?.name === table.name && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Columns</p>
                          <div className="space-y-1">
                            {table.columns.map((col) => (
                              <div key={col.name} className="flex items-center justify-between text-xs">
                                <span className="font-mono">{col.name}</span>
                                <span className="text-muted-foreground">{col.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Authenticated Users</h3>
                <span className="text-xs text-muted-foreground">From Supabase Auth</span>
              </div>

              {!supabaseCredentials ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Connect Supabase first</p>
                  <p className="text-xs text-muted-foreground mt-1">Provide your Supabase credentials to view users</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No users yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Users will appear when they sign up on your app</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name || user.email}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-muted">{user.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Activity Logs</h3>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No logs yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50">
                      {getLogIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{log.message}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
