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

interface ConnectionData {
  supabaseUrl: string
  anonKey: string
  serviceRoleKey?: string // Added optional service role key
  projectRef?: string
  projectName?: string
}

type TabType = "credentials" | "tables" | "users" | "logs"

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("credentials")
  const [users, setUsers] = useState<SupabaseUser[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; connection?: ConnectionData } | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const [tablesError, setTablesError] = useState<string | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [logsError, setLogsError] = useState<string | null>(null)

  // Check connection status (global/user-level)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch("/api/user/supabase-connection")
        if (!res.ok) throw new Error("Failed to fetch connection status")
        const data = await res.json()
        setConnectionStatus(data)
        setConnectionError(null)
      } catch (error) {
        console.error("[DatabasePanel] Connection check error:", error)
        setConnectionError("Failed to check database connection status")
        setConnectionStatus(null)
      }
    }
    checkConnection()
  }, [])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!connectionStatus?.connected) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/supabase/users`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setUsers(data.users || []);
      setUsersError(null);
    } catch (err) {
      console.error("[DatabasePanel] Users fetch error:", err);
      const error = err as Error; // ← this line fixes the TS error
      setUsersError(
        `Failed to load users: ${error.message}. Ensure service role key is configured for admin access.`
      );
    }
  }, [projectId, connectionStatus?.connected]);

  // Fetch tables
  const fetchTables = useCallback(async () => {
    if (!connectionStatus?.connected) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/supabase/tables`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setTables(data.tables || []);
      setTablesError(null);
    } catch (err) {
      console.error("[DatabasePanel] Tables fetch error:", err);
      const error = err as Error;
      setTablesError(`Failed to load tables: ${error.message}. Check connection and permissions.`);
    }
  }, [projectId, connectionStatus?.connected]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/database/logs?limit=100`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setLogsError(null)
    } catch (error) {
      console.error("[DatabasePanel] Logs fetch error:", error)
      setLogsError("Failed to load logs.")
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    fetchLogs()
    if (connectionStatus?.connected) {
      setLoading(true)
      Promise.all([fetchTables(), fetchUsers()]).finally(() => setLoading(false))
    }
  }, [connectionStatus, fetchTables, fetchUsers, fetchLogs])

  // Refresh function (with optional manual flag for loading indicator)
  const refresh = useCallback(async (isManual: boolean = false) => {
    if (isManual) setLoading(true)
    if (connectionStatus?.connected || activeTab === "logs") {
      if (activeTab === "users") await fetchUsers()
      else if (activeTab === "tables") await fetchTables()
      else if (activeTab === "logs") await fetchLogs()
    }
    if (isManual) setLoading(false)
  }, [activeTab, connectionStatus?.connected, fetchUsers, fetchTables, fetchLogs])

  // Auto-refresh on tab change
  useEffect(() => {
    refresh(false)
  }, [activeTab, refresh])

  // Polling for live updates (silent, no loading spinner)
  useEffect(() => {
    if (activeTab === "logs" || connectionStatus?.connected) {
      const interval = setInterval(() => refresh(false), 5000) // Increased to every 5 seconds for more "live" feel
      return () => clearInterval(interval)
    }
  }, [activeTab, connectionStatus?.connected, refresh])

  // Copy to clipboard
  const copyToClipboard = async (text: string | undefined, field: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

  const connection = connectionStatus?.connection

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
          onClick={() => refresh(true)}
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
                <h3 className="text-sm font-medium text-foreground">Database Credentials</h3>
              </div>

              {connectionError ? (
                <div className="text-center py-8 text-red-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">{connectionError}</p>
                </div>
              ) : connectionStatus?.connected && connection ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Database Connected</span>
                    </div>
                    {connection.projectName && (
                      <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                        Project: {connection.projectName}
                        {connection.projectRef && ` (${connection.projectRef})`}
                      </p>
                    )}
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Your database is connected and ready.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">VITE_SUPABASE_URL</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono text-foreground break-all">
                          {connection.supabaseUrl}
                        </code>
                        <button
                          onClick={() => copyToClipboard(connection.supabaseUrl, "url")}
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
                          {connection.anonKey.substring(0, 20)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(connection.anonKey, "key")}
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

                    {connection.serviceRoleKey && (
                      <div className="p-3 bg-muted rounded-lg">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          SUPABASE_SERVICE_ROLE_KEY
                        </label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm font-mono text-foreground break-all">
                            {connection.serviceRoleKey.substring(0, 20)}...
                          </code>
                          <button
                            onClick={() => copyToClipboard(connection.serviceRoleKey, "service")}
                            className="p-1.5 hover:bg-accent rounded"
                          >
                            {copiedField === "service" ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      These credentials are automatically injected into your .env file for the preview. Service role key is required for admin operations like listing users.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">No Database Connection</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Connect your database in the code editor to view credentials, tables, and users.
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
              </div>

              {tablesError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-sm text-red-500 mb-4">{tablesError}</p>
                  <button onClick={fetchTables} className="text-sm underline text-foreground">
                    Retry
                  </button>
                </div>
              ) : !connectionStatus?.connected ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Table2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Connect database first</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect your database to view tables</p>
                </div>
              ) : tables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Table2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tables yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tables will appear after pushing SQL migrations. Refresh to check for updates.
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
                <h3 className="text-sm font-medium text-foreground">Database Users</h3>
              </div>

              {usersError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-sm text-red-500 mb-4">{usersError}</p>
                  <button onClick={fetchUsers} className="text-sm underline text-foreground">
                    Retry
                  </button>
                </div>
              ) : !connectionStatus?.connected ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Connect database first</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect your database to view users</p>
                </div>
              ) : !connection?.serviceRoleKey ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Service Role Key Required</p>
                  <p className="text-xs text-muted-foreground mt-1">Provide your Supabase service role key in the connection settings to view authenticated users.</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No users yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Users will appear when they sign up via Supabase Auth. If using another auth provider like Clerk, consider syncing users to Supabase.</p>
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

              {logsError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-sm text-red-500 mb-4">{logsError}</p>
                  <button onClick={fetchLogs} className="text-sm underline text-foreground">
                    Retry
                  </button>
                </div>
              ) : logs.length === 0 ? (
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