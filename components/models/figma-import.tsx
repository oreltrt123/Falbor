"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Figma } from "lucide-react"

export function FigmaImport() {
  const [isOpen, setIsOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [selectedFileKey, setSelectedFileKey] = useState("")
  const [tokenInput, setTokenInput] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { user } = useUser()

  useEffect(() => {
    if (user?.id && !loading) {
      fetchStatus()
    }
  }, [user?.id, loading])

  useEffect(() => {
    if (connected && !loading) {
      fetchFiles()
    }
  }, [connected, loading])

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/figma/status")
      if (res.ok) {
        const data = await res.json()
        setConnected(data.connected)
      }
    } catch (error) {
      console.error("Failed to fetch Figma status:", error)
    }
  }

  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/figma/files")
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
      } else {
        console.error("Failed to fetch Figma files:", res.statusText)
        setConnected(false)
      }
    } catch (error) {
      console.error("Failed to fetch Figma files:", error)
    }
  }

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/figma/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      })
      if (res.ok) {
        setConnected(true)
        setTokenInput("")
        fetchFiles()
      } else {
        const err = await res.json()
        alert(`Invalid token: ${err.error || "Try again"}`)
      }
    } catch (error) {
      alert("Failed to save token")
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFileKey) return
    setLoading(true)
    try {
      const res = await fetch("/api/figma/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey: selectedFileKey }),
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const { projectId } = await res.json()
      setIsOpen(false)
      router.push(`/chat/${projectId}`)
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => {}}
        className="text-sm font-medium cursor-pointer py-1 p-2 hover:border-[#ff8c001f] rounded-4xl bg-[#ffffff] text-[#000000] flex items-center gap-2"
      >
        <Figma size={16} className="h-4 w-4" />
        <span className="font-sans font-light">Figma</span>
        <span className="text-xs rounded-4xl bg-[#0099ffbb] text-white px-1.5 py-0.5 cursor-not-allowed">
          Coming Soon
        </span>
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#1f1e1e] border border-[#272727] rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-medium">Import from Figma</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/50 hover:text-white text-xl font-bold"
              >
                ×
              </button>
            </div>
            {!connected ? (
              <div className="space-y-2">
                <p className="text-white/70 text-sm">
                  Get your token at <a href="https://www.figma.com/developers/api#access-token" target="_blank" className="underline">figma.com/developers/api</a> (scopes: file_read, file_content:read).
                </p>
                <input
                  type="password"
                  placeholder="Paste your Figma Personal Access Token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full bg-[#272727] text-white p-2 rounded border border-[#44444450] focus:outline-none focus:border-[#ff8c00]"
                />
                <button
                  onClick={handleSaveToken}
                  disabled={!tokenInput.trim() || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Saving..." : "Save Token & Fetch Files"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <select
                  value={selectedFileKey}
                  onChange={(e) => setSelectedFileKey(e.target.value)}
                  className="w-full bg-[#272727] text-white p-2 rounded border border-[#44444450] focus:outline-none focus:border-[#ff8c00]"
                >
                  <option value="">Select a design file</option>
                  {files.map((file) => (
                    <option key={file.key} value={file.key}>
                      {file.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleImport}
                  disabled={!selectedFileKey || loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Importing..." : "Clone Design to Code"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}