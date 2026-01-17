"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { CardContent } from "@/components/ui/card"
import { Loader2, Save, Trash2, Lock, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Project {
  id: string
  title: string
  description?: string | null
  coverImage?: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

interface ProjectSettingsProps {
  projectId: string
}

export default function ProjectSettings({ projectId }: ProjectSettingsProps) {
  const { isLoaded, isSignedIn } = useUser()

  const [project, setProject] = useState<Project | null>(null)
  const [tempProject, setTempProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const fetchProject = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/projects/${projectId}`, {
          credentials: "include",
        })

        if (!res.ok) throw new Error("Project not found")

        const data = await res.json()
        setProject(data)
        setTempProject(data)
      } catch {
        setError("Failed to load project")
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [projectId, isLoaded, isSignedIn])

  const updateTempField = (key: keyof Project, value: any) => {
    if (tempProject) {
      setTempProject({ ...tempProject, [key]: value })
    }
  }

  const handleSave = async () => {
    if (!tempProject) return
    setSaving(true)

    try {
      const payload = {
        description: tempProject.description,
        coverImage: tempProject.coverImage,
        isPublic: tempProject.isPublic,
      }

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      })

      if (!res.ok) throw new Error("Save failed")

      setProject({ ...tempProject })
    } catch {
      setError("Failed to save project")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) throw new Error("Delete failed")

      window.location.href = "/projects"
    } catch {
      setError("Failed to delete project")
    } finally {
      setDeleting(false)
    }
  }

  // ✅ REAL IMAGE UPLOAD THAT SAVES
  const handleImageUpload = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!res.ok) {
      alert("Upload failed")
      return
    }

    const data = await res.json()

    // Save image URL into tempProject
    updateTempField("coverImage", data.url)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !project || !tempProject) {
    return <div className="text-center text-destructive py-12">{error}</div>
  }

  return (
    <div className="p-2 space-y-3">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">General</h2>
          <p className="text-xs font-mono bg-white px-2 py-1 rounded">{project.id}</p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="h-7">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      {/* TITLE */}
      <div className="border rounded-sm">
        <CardContent className="px-2 py-2">
          <h3 className="font-semibold mb-2 ml-1">Main chat title</h3>
          <Input
            value={project.title}
            className="text-lg font-medium bg-white border-none"
            disabled
          />
        </CardContent>
      </div>

      {/* DESCRIPTION */}
      <div className="border rounded-sm">
        <CardContent className="px-2 py-2">
          <h3 className="font-semibold text-md mb-2 ml-1">Chat Description</h3>
          <Textarea
            value={tempProject.description || ""}
            onChange={(e) => updateTempField("description", e.target.value)}
            rows={3}
            placeholder="Project description..."
          />
        </CardContent>
      </div>

      {/* COVER IMAGE */}
      <div className="border rounded-sm">
        <CardContent className="px-2 py-2">
          <h3 className="font-semibold text-md mb-2 ml-1">Upload a cover photo for the chat</h3>
          {tempProject.coverImage && (
            <img
              src={tempProject.coverImage}
              className="w-full h-32 object-cover rounded mb-2"
            />
          )}

          <Input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
          />
        </CardContent>
      </div>

      {/* PROJECT VISIBILITY */}
      <div className="border rounded-lg p-3 space-y-2">
        <h3 className="font-semibold text-md">Project Visibility</h3>
        <p className="mb-2 mt-[-8px] text-[12px]">Control who can access your chat</p>
        <div className="grid grid-cols-2 gap-3">

          {/* PRIVATE */}
          <button
            onClick={() => updateTempField("isPublic", false)}
            className={`flex flex-col items-start p-3 rounded-lg border transition cursor-pointer
              ${!tempProject.isPublic
                ? "bg-blue-950 border-blue-500 text-blue-300"
                : "bg-neutral-900 border-neutral-700 text-neutral-400"
              }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4" />
              Private
            </div>
            <span className="text-xs opacity-80">Only owner can access</span>
          </button>

          {/* PUBLIC */}
          <button
            onClick={() => updateTempField("isPublic", true)}
            className={`flex flex-col items-start p-3 rounded-lg border transition cursor-pointer
              ${tempProject.isPublic
                ? "bg-blue-950 border-blue-500 text-blue-300"
                : "bg-neutral-900 border-neutral-700 text-neutral-400"
              }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <Globe className="h-4 w-4" />
              Public
            </div>
            <span className="text-xs opacity-80">Everyone can view</span>
          </button>

        </div>
      </div>

      {/* DELETE */}
      <div className="border rounded-sm p-4 mt-6">
        <h3 className="font-semibold text-md">Delete Project</h3>
        <p className="mb-2 text-[12px]">This action is permanent and cannot be undone.</p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Project
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl">Delete Chat?</AlertDialogTitle>
              <AlertDialogDescription className="text-lg">
                You are about to delete {project.title}.
              </AlertDialogDescription>
              <AlertDialogDescription className="text-lg">
                Are you sure you want to delete this chat?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel className="">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  )
}
