# AI Website Builder - Database Integration Prompt

## CRITICAL: Database Connection Setup

EVERY project you create MUST properly connect to the platform's database API. The generated site runs in the user's browser but stores data on the platform's server.

### MANDATORY FILES FOR ALL PROJECTS

When building ANY site with data persistence or authentication, you MUST create these files in order:

1. **lib/db.ts** - Database client that connects to platform API
2. **lib/auth.ts** - Authentication helper using platform database
3. **components/auth/LoginForm.tsx** - Login UI (if auth is needed)
4. **components/auth/SignUpForm.tsx** - Signup UI (if auth is needed)

---

## 1. Database Client (lib/db.ts)

This file connects to YOUR platform's database API. The PROJECT_ID is extracted from:
- URL pattern: `/preview/{PROJECT_ID}`
- Query parameter: `?project_id={PROJECT_ID}`
- Global variable: `window.__PROJECT_ID__`

```typescript
// lib/db.ts
function getProjectId(): string {
  if (typeof window !== "undefined") {
    // Check if explicitly set by platform
    if ((window as any).__PROJECT_ID__) {
      return (window as any).__PROJECT_ID__
    }

    // Extract from preview URL: /preview/{PROJECT_ID}
    const match = window.location.pathname.match(/\/preview\/([^/]+)/)
    if (match) {
      return match[1]
    }

    // Extract from query param
    const urlParams = new URLSearchParams(window.location.search)
    const projectId = urlParams.get("project_id")
    if (projectId) {
      return projectId
    }
  }

  console.error("[DB] PROJECT_ID not found. Database operations will fail.")
  return "unknown"
}

export const db = {
  // Users
  async getUsers() {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/users\`)
    if (!res.ok) throw new Error(\`Failed to fetch users: \${res.statusText}\`)
    return res.json()
  },

  async createUser(data: { email: string; name?: string; role?: string; password_hash: string }) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/users\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(\`Failed to create user: \${res.statusText}\`)
    return res.json()
  },

  async getUserByEmail(email: string) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/users?email=\${encodeURIComponent(email)}\`)
    if (!res.ok) throw new Error(\`Failed to fetch user: \${res.statusText}\`)
    return res.json()
  },

  async updateUser(userId: string, data: { name?: string; role?: string }) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/users/\${userId}\`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(\`Failed to update user: \${res.statusText}\`)
    return res.json()
  },

  async deleteUser(userId: string) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/users/\${userId}\`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error(\`Failed to delete user: \${res.statusText}\`)
    return res.json()
  },

  // Tables
  async getTables() {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/tables\`)
    if (!res.ok) throw new Error(\`Failed to fetch tables: \${res.statusText}\`)
    return res.json()
  },

  async createTable(data: { table_name: string; columns: Array<{ name: string; type: string }> }) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/tables\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(\`Failed to create table: \${res.statusText}\`)
    return res.json()
  },

  async getTableRows(tableId: string) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/tables/\${tableId}\`)
    if (!res.ok) throw new Error(\`Failed to fetch table rows: \${res.statusText}\`)
    return res.json()
  },

  async insertRow(tableId: string, data: Record<string, any>) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/tables/\${tableId}/rows\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    })
    if (!res.ok) throw new Error(\`Failed to insert row: \${res.statusText}\`)
    return res.json()
  },

  async updateRow(tableId: string, rowId: string, data: Record<string, any>) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/tables/\${tableId}/rows/\${rowId}\`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    })
    if (!res.ok) throw new Error(\`Failed to update row: \${res.statusText}\`)
    return res.json()
  },

  async deleteRow(tableId: string, rowId: string) {
    const projectId = getProjectId()
    const res = await fetch(\`/api/projects/\${projectId}/database/tables/\${tableId}/rows/\${rowId}\`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error(\`Failed to delete row: \${res.statusText}\`)
    return res.json()
  },
}
```

---

## 2. Authentication Helper (lib/auth.ts)

This file provides login/signup functionality using the platform's database:

```typescript
// lib/auth.ts
import { db } from "./db"

// Simple hash function (use bcrypt on server in production)
async function simpleHash(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const auth = {
  async login(email: string, password: string) {
    try {
      console.log("[Auth] Attempting login for:", email)
      const result = await db.getUserByEmail(email)

      if (!result.user) {
        throw new Error("Invalid email or password")
      }

      const passwordHash = await simpleHash(password)
      if (result.user.password_hash !== passwordHash) {
        throw new Error("Invalid email or password")
      }

      const session = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        loginAt: Date.now(),
      }

      localStorage.setItem("currentUser", JSON.stringify(session))
      console.log("[Auth] Login successful")
      return session
    } catch (error) {
      console.error("[Auth] Login failed:", error)
      throw error
    }
  },

  async signup(email: string, password: string, name?: string) {
    try {
      console.log("[Auth] Attempting signup for:", email)
      const passwordHash = await simpleHash(password)

      const result = await db.createUser({
        email,
        name: name || "",
        role: "user",
        password_hash: passwordHash,
      })

      const session = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        loginAt: Date.now(),
      }

      localStorage.setItem("currentUser", JSON.stringify(session))
      console.log("[Auth] Signup successful")
      return session
    } catch (error) {
      console.error("[Auth] Signup failed:", error)
      throw error
    }
  },

  logout() {
    localStorage.removeItem("currentUser")
    console.log("[Auth] Logged out")
  },

  getCurrentUser() {
    const userStr = localStorage.getItem("currentUser")
    if (!userStr) return null
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  },

  isAuthenticated() {
    return this.getCurrentUser() !== null
  },
}
```

---

## 3. Login Form Component

```typescript
// components/auth/LoginForm.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { auth } from "@/lib/auth"

interface LoginFormProps {
  onSuccess?: () => void
  onSwitchToSignUp?: () => void
}

export function LoginForm({ onSuccess, onSwitchToSignUp }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await auth.login(email, password)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <div className="mt-4 text-center">
        <button onClick={onSwitchToSignUp} type="button" className="text-sm text-blue-600 hover:underline">
          Don't have an account? Sign up
        </button>
      </div>
    </div>
  )
}
```

---

## 4. Signup Form Component

```typescript
// components/auth/SignUpForm.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { auth } from "@/lib/auth"

interface SignUpFormProps {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export function SignUpForm({ onSuccess, onSwitchToLogin }: SignUpFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await auth.signup(email, password, name)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Name (optional)</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
          <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
      <div className="mt-4 text-center">
        <button onClick={onSwitchToLogin} type="button" className="text-sm text-blue-600 hover:underline">
          Already have an account? Login
        </button>
      </div>
    </div>
  )
}
```

---

## RULES FOR AI GENERATION

### When to Create Database Files:

1. **ALWAYS create lib/db.ts** when building:
   - Sites with user accounts
   - Sites that store custom data
   - Sites with dynamic content
   - Any app requiring data persistence

2. **ALWAYS create lib/auth.ts and auth components** when building:
   - Login/signup pages
   - User dashboards
   - Admin panels
   - Protected content areas

### Usage Examples:

```typescript
// Example: Custom data table for a blog
import { db } from '@/lib/db'

// Create posts table
await db.createTable({
  table_name: 'blog_posts',
  columns: [
    { name: 'title', type: 'text' },
    { name: 'content', type: 'text' },
    { name: 'author_id', type: 'text' },
    { name: 'published', type: 'boolean' },
  ],
})

// Insert a post
await db.insertRow(tableId, {
  title: 'My First Post',
  content: 'Hello world!',
  author_id: currentUser.id,
  published: true,
})

// Fetch all posts
const { rows } = await db.getTableRows(tableId)
```

```typescript
// Example: Protected page
import { auth } from '@/lib/auth'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProtectedPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const currentUser = auth.getCurrentUser()
    if (!currentUser) {
      router.push('/login')
    } else {
      setUser(currentUser)
    }
  }, [router])

  if (!user) return <div>Loading...</div>

  return <div>Welcome {user.name}!</div>
}
```

---

## IMPORTANT NOTES

- All API calls use relative paths: `/api/projects/${PROJECT_ID}/database/*`
- The platform hosts BOTH the preview AND the database API
- PROJECT_ID is automatically extracted from the URL
- Users manage data through the platform's Database Panel
- All operations are logged and visible in platform logs
- NEVER use localStorage for persistent data (only for session management)
- ALWAYS add console.log statements for debugging database operations
