"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"  // Client-safe hook only
import { Card, CardContent } from "@/components/ui/card"
import { CalendarIcon, Loader2, Settings2, Edit3, Save, Image, Globe, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

interface Project {
  id: string
  title: string
  description?: string | null
  coverImage?: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  firstName?: string | null
  imageUrl: string
}

interface ProjectSettingsProps {
  projectId: string
}

export default function ProjectSettings({ projectId }: ProjectSettingsProps) {
  const { isLoaded, isSignedIn, user } = useUser()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tempProject, setTempProject] = useState<Project | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const fetchProject = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/projects/${projectId}`, {
          credentials: 'include',  // Ensures auth cookies are sent
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Project not found')
        }
        const data = await response.json()
        setProject(data)
        setTempProject(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [projectId, isLoaded, isSignedIn])

  const handleEdit = () => {
    setEditing(true)
    setTempProject({ ...project! })
  }

  const handleCancel = () => {
    setEditing(false)
    setTempProject(project)
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

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save project')
      }

      setProject({ ...tempProject })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete project')
      }

      // Optionally redirect to projects list or handle success
      window.location.href = '/projects'  // Or use router.push if using next/router
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  const updateTempField = (key: keyof Project, value: any) => {
    if (tempProject) {
      setTempProject({ ...tempProject, [key]: value })
    }
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center text-destructive py-12">
        {error || 'Project not found.'}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center text-destructive py-12">
      User not found.
    </div>
  )
}

  const currentUser: User = {
    id: user.id,
    firstName: user.firstName,
    imageUrl: user.imageUrl || "/default-avatar.png",
  }

  return (
    <div className="p-6">
      {/* Main Project Title */}
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-black text-2xl font-light">
          Project Settings
        </h1>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <Button variant="outline" onClick={handleEdit} className="shadow-none h-7">
                <Edit3 className="h-4 w-4 mr-2" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="shadow-none h-7">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the project "{project.title}" and all related data (messages, files, artifacts).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="shadow-none h-7">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="shadow-none h-7" onClick={handleDelete} disabled={deleting}>
                      {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      {deleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} className="shadow-none h-7">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="shadow-none h-7">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Project Title & ID Card */}
        <div className="transition-colors duration-200 shadow-none bg-[#e4e4e48c] rounded-sm md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                <Settings2 className="h-4 w-4 text-black" />
              </div>
              <h3 className="text-black text-sm font-semibold">Project Info</h3>
            </div>
            <Input
              value={tempProject?.title || project.title}
              className="mb-2 text-lg font-medium bg-white border-none"
              disabled
            />
            <p className="text-xs text-black/70 mb-2 truncate font-mono bg-white px-2 py-1 rounded">
              {project.id}
            </p>
            <p className="text-xs text-black/60">
              Unique identifier for this project. Used to reference and share across the platform.
            </p>
          </CardContent>
        </div>

        {/* Creator Card */}
        <div className="transition-colors duration-200 shadow-none bg-[#e4e4e48c] rounded-sm">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-2">
              <img
                src={currentUser.imageUrl}
                alt={`${currentUser.firstName || "User"}'s profile`}
                className="w-8 h-8 rounded-full object-cover"
              />
              <h3 className="text-black text-sm font-semibold">Creator</h3>
            </div>
            <p className="text-xs text-black/70 mb-2">
              {currentUser.firstName || "User"}
            </p>
            <p className="text-xs text-black/60">
              The individual who initiated this project. All ownership and edits are tied to this account.
            </p>
          </CardContent>
        </div>
      </div>

      {/* Additional Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {/* Description Card */}
        <div className="transition-colors duration-200 shadow-none bg-[#e4e4e48c] rounded-sm md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                <Settings2 className="h-4 w-4 text-black" />
              </div>
              <h3 className="text-black text-sm font-semibold">Description</h3>
            </div>
            <Textarea
              value={editing ? (tempProject?.description || '') : (project.description || '')}
              onChange={(e) => updateTempField('description', e.target.value)}
              placeholder="Enter project description..."
              disabled={!editing}
              rows={3}
            />
            <p className="text-xs text-black/60">
              A brief overview of your project.
            </p>
          </CardContent>
        </div>

        {/* Cover Image Card */}
        <div className="transition-colors duration-200 shadow-none bg-[#e4e4e48c] rounded-sm">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                <Image className="h-4 w-4 text-black" />
              </div>
              <h3 className="text-black text-sm font-semibold">Cover Image</h3>
            </div>
            {project.coverImage && (
              <img
                src={project.coverImage}
                alt="Cover"
                className="w-full h-24 object-cover rounded mb-2"
              />
            )}
            <Input
              type="url"
              placeholder="Enter cover image URL"
              value={editing ? (tempProject?.coverImage || '') : (project.coverImage || '')}
              onChange={(e) => updateTempField('coverImage', e.target.value)}
              className="mb-2 bg-white shadow-none border-none"
              disabled={!editing}
            />
            <p className="text-xs text-black/60">
              Provide a URL for your project's cover image.
            </p>
          </CardContent>
        </div>

        {/* Public Toggle Card */}
        <div className="transition-colors duration-200 shadow-none bg-[#e4e4e48c] rounded-sm">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                <Globe className="h-4 w-4 text-black" />
              </div>
              <h3 className="text-black text-sm font-semibold">Public</h3>
            </div>
            <Switch
              checked={editing ? (tempProject?.isPublic || false) : (project.isPublic || false)}
              onCheckedChange={(checked) => updateTempField('isPublic', checked)}
              disabled={!editing}
            />
            <p className="text-xs text-black/60 mt-2">
              Make this project visible to others (public) or keep it private.
            </p>
          </CardContent>
        </div>
        {/* Created Date Card */}
        <div className="transition-colors duration-200 shadow-none bg-[#e4e4e48c] rounded-sm">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-black" />
              </div>
              <h3 className="text-black text-sm font-semibold">Created</h3>
            </div>
            <p className="text-xs text-black/70 mb-2">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-black/60">
              The date this project was first created. Tracks the origin and timeline of your work.
            </p>
          </CardContent>
        </div>
      </div>
    </div>
  )
}