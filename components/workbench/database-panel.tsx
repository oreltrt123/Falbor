"use client"

import { useCallback } from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Users,
  Table2,
  Terminal,
  Plus,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DatabasePanelProps {
  projectId: string
}

interface User {
  id: string
  email: string
  name: string | null
  role: string
  created_at: string
  updated_at: string
}

interface TableInfo {
  id: string
  table_name: string
  columns: Array<{ name: string; type: string; nullable?: boolean }>
  row_count: number
  created_at: string
}

interface LogEntry {
  id: string
  level: "info" | "warn" | "error" | "success"
  message: string
  details: Record<string, any> | null
  created_at: string
}

type TabType = "users" | "tables" | "logs"

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("users")
  const [users, setUsers] = useState<User[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null)
  const [tableRows, setTableRows] = useState<any[]>([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddTable, setShowAddTable] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Form states
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserName, setNewUserName] = useState("")
  const [newUserRole, setNewUserRole] = useState("user")
  const [newTableName, setNewTableName] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("") // Added password field to user creation form

  // Fetch database info
  const fetchDatabaseInfo = useCallback(async () => {
    try {
      // Initialize database
      await fetch(`/api/projects/${projectId}/database`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: ["users"] }),
      })
    } catch (error) {
      console.error("[Database] Init error:", error)
    }
  }, [projectId])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/database/users`)
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error("[Database] Users fetch error:", error)
    }
  }, [projectId])

  // Fetch tables
  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/database/tables`)
      const data = await res.json()
      setTables(data.tables || [])
    } catch (error) {
      console.error("[Database] Tables fetch error:", error)
    }
  }, [projectId])

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/database/logs?limit=100`)
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error("[Database] Logs fetch error:", error)
    }
  }, [projectId])

  // Fetch table rows
  const fetchTableRows = useCallback(
    async (tableId: string) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/database/tables/${tableId}`)
        const data = await res.json()
        setTableRows(data.rows || [])
      } catch (error) {
        console.error("[Database] Rows fetch error:", error)
      }
    },
    [projectId],
  )

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchDatabaseInfo()
      await Promise.all([fetchUsers(), fetchTables(), fetchLogs()])
      setLoading(false)
    }
    init()
  }, [fetchDatabaseInfo, fetchUsers, fetchTables, fetchLogs])

  // Refresh based on active tab
  const refresh = useCallback(async () => {
    setLoading(true)
    if (activeTab === "users") await fetchUsers()
    else if (activeTab === "tables") await fetchTables()
    else await fetchLogs()
    setLoading(false)
  }, [activeTab, fetchUsers, fetchTables, fetchLogs])

  // Add user
  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      alert("Email and password are required")
      return
    }

    setLoading(true)
    try {
      // Hash password (simple client-side hash, server should do proper bcrypt)
      const encoder = new TextEncoder()
      const data = encoder.encode(newUserPassword)
      const hashBuffer = await crypto.subtle.digest("SHA-256", data)
      const password_hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      console.log("[DatabasePanel] Creating user:", { email: newUserEmail, name: newUserName, role: newUserRole })

      const res = await fetch(`/api/projects/${projectId}/database/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName || null,
          role: newUserRole,
          password_hash,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error("[DatabasePanel] Failed to create user:", errorData)
        alert(`Failed to create user: ${errorData.error || "Unknown error"}`)
        return
      }

      const responseData = await res.json()
      console.log("[DatabasePanel] User created successfully:", responseData)

      setShowAddUser(false)
      setNewUserEmail("")
      setNewUserName("")
      setNewUserPassword("")
      setNewUserRole("user")
      await fetchUsers()
      await fetchLogs()
    } catch (error) {
      console.error("[DatabasePanel] Add user error:", error)
      alert(`Error creating user: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  // Update user
  const handleUpdateUser = async () => {
    if (!editingUser) return
    try {
      await fetch(`/api/projects/${projectId}/database/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingUser.name,
          role: editingUser.role,
        }),
      })
      setEditingUser(null)
      setSelectedUser(null)
      await fetchUsers()
      await fetchLogs()
    } catch (error) {
      console.error("[Database] Update user error:", error)
    }
  }

  // Delete user
  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      await fetch(`/api/projects/${projectId}/database/users/${userId}`, {
        method: "DELETE",
      })
      setSelectedUser(null)
      await fetchUsers()
      await fetchLogs()
    } catch (error) {
      console.error("[Database] Delete user error:", error)
    }
  }

  // Add table
  const handleAddTable = async () => {
    if (!newTableName) return
    try {
      await fetch(`/api/projects/${projectId}/database/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_name: newTableName,
          columns: [
            { name: "id", type: "uuid", nullable: false },
            { name: "created_at", type: "timestamp", nullable: false },
          ],
        }),
      })
      setShowAddTable(false)
      setNewTableName("")
      await fetchTables()
      await fetchLogs()
    } catch (error) {
      console.error("[Database] Add table error:", error)
    }
  }

  // Delete table
  const handleDeleteTable = async (tableId: string) => {
    if (!confirm("Are you sure you want to delete this table? All data will be lost.")) return
    try {
      await fetch(`/api/projects/${projectId}/database/tables/${tableId}`, {
        method: "DELETE",
      })
      setSelectedTable(null)
      await fetchTables()
      await fetchLogs()
    } catch (error) {
      console.error("[Database] Delete table error:", error)
    }
  }

  // Clear logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all logs?")) return
    try {
      await fetch(`/api/projects/${projectId}/database/logs`, {
        method: "DELETE",
      })
      await fetchLogs()
    } catch (error) {
      console.error("[Database] Clear logs error:", error)
    }
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

  if (loading && users.length === 0 && tables.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">Loading database...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto w-full">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "users" ? "bg-gray-100 text-black" : "text-gray-600 hover:bg-gray-50",
            )}
          >
            <Users className="w-4 h-4" />
            Users
            <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">{users.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("tables")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "tables" ? "bg-gray-100 text-black" : "text-gray-600 hover:bg-gray-50",
            )}
          >
            <Table2 className="w-4 h-4" />
            Tables
            <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">{tables.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "logs" ? "bg-gray-100 text-black" : "text-gray-600 hover:bg-gray-50",
            )}
          >
            <Terminal className="w-4 h-4" />
            Logs
          </button>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-md transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 overflow-auto">
          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">User Management</h3>
                <Button
                  size="sm"
                  onClick={() => setShowAddUser(true)}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add User
                </Button>
              </div>

              {/* Add User Form */}
              {showAddUser && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">New User</span>
                    <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="email"
                      placeholder="Email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <input
                      type="text"
                      placeholder="Name (optional)"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="moderator">Moderator</option>
                    </select>
                    <Button
                      onClick={handleAddUser}
                      disabled={!newUserEmail || !newUserPassword || loading}
                      className="w-full bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {loading ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Users List */}
              {users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No users yet</p>
                  <p className="text-xs text-gray-400 mt-1">Users will appear here when the AI creates auth</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedUser?.id === user.id
                          ? "border-black bg-gray-50"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs rounded-full",
                            user.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : user.role === "moderator"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700",
                          )}
                        >
                          {user.role}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tables Tab */}
          {activeTab === "tables" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Database Tables</h3>
                <Button
                  size="sm"
                  onClick={() => setShowAddTable(true)}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Table
                </Button>
              </div>

              {/* Add Table Form */}
              {showAddTable && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">New Table</span>
                    <button onClick={() => setShowAddTable(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Table name"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <Button
                      onClick={handleAddTable}
                      className="w-full py-1.5 text-sm bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Create Table
                    </Button>
                  </div>
                </div>
              )}

              {/* Tables List */}
              {tables.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Table2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tables yet</p>
                  <p className="text-xs text-gray-400 mt-1">Tables will be created by the AI</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      onClick={() => {
                        setSelectedTable(table)
                        fetchTableRows(table.id)
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedTable?.id === table.id
                          ? "border-black bg-gray-50"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Table2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{table.table_name}</p>
                          <p className="text-xs text-gray-500">
                            {table.columns?.length || 0} columns · {table.row_count || 0} rows
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
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
                <h3 className="text-sm font-medium text-gray-900">Database Logs</h3>
                <Button
                  size="sm"
                  onClick={handleClearLogs}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </Button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No logs yet</p>
                </div>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded",
                        log.level === "error" && "bg-red-50",
                        log.level === "warn" && "bg-yellow-50",
                        log.level === "success" && "bg-green-50",
                        log.level === "info" && "bg-blue-50",
                      )}
                    >
                      {getLogIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900">{log.message}</p>
                        <p className="text-gray-400 text-[10px]">{new Date(log.created_at).toLocaleString()}</p>
                        {log.details && (
                          <pre className="mt-1 text-gray-500 overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Detail Sidebar */}
        {selectedUser && activeTab === "users" && (
          <div className="w-72 border-l border-gray-200 bg-gray-50 overflow-auto h-[90vh]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900">User Details</h4>
                <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-medium text-gray-600 mx-auto mb-2">
                    {selectedUser.name?.[0] || selectedUser.email[0].toUpperCase()}
                  </div>
                  <p className="font-medium text-sm">{selectedUser.name || "No name"}</p>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>

                {editingUser?.id === selectedUser.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingUser.name || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      placeholder="Name"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="moderator">Moderator</option>
                    </select>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateUser}
                        className="flex-1 py-1.5 text-sm bg-black text-white hover:bg-gray-800 transition-colors"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingUser(null)}
                        className="flex-1 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 border-b border-gray-200">
                        <span className="text-xs text-gray-500">Role</span>
                        <span className={cn("px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800")}>
                          {selectedUser.role}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-200">
                        <span className="text-xs text-gray-500">Created</span>
                        <span className="text-xs text-gray-900">
                          {new Date(selectedUser.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Table Detail Sidebar */}
        {selectedTable && activeTab === "tables" && (
          <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-auto h-[90vh]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900">{selectedTable.table_name}</h4>
                <button onClick={() => setSelectedTable(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Columns</h5>
                  <div className="space-y-1">
                    {selectedTable.columns?.map((col, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-gray-200"
                      >
                        <span className="text-xs font-mono text-gray-900">{col.name}</span>
                        <span className="text-xs text-gray-500">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Data ({tableRows.length} rows)</h5>
                  {tableRows.length === 0 ? (
                    <p className="text-xs text-gray-400">No data yet</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-auto">
                      {tableRows.slice(0, 10).map((row) => (
                        <div key={row.id} className="p-2 bg-white rounded border border-gray-200">
                          <pre className="text-xs text-gray-700 overflow-x-auto">
                            {JSON.stringify(row.data, null, 2)}
                          </pre>
                        </div>
                      ))}
                      {tableRows.length > 10 && (
                        <p className="text-xs text-gray-400 text-center py-2">+{tableRows.length - 10} more rows</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
