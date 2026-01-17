"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { CardDesignSelector, type CardDesignType } from "../card-designs"
import { Upload, X, ImageIcon, Plus, Loader2, Check, AlertCircle, ExternalLink, Rocket, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface PublishTemplateSectionProps {
  projectId: string
}

const MAX_TAGS = 5
const MIN_IMAGES = 4

interface ExistingTemplate {
  id: string
  title: string
  description: string
  mainImage: string
  images: string[]
  tags: string[]
  domain: string
  cardDesign: CardDesignType
}

interface DeploymentData {
  deploymentUrl: string
  updatedAt: string
}

interface CreditsData {
  subscriptionTier: string
}

export function PublishTemplateSection({ projectId }: PublishTemplateSectionProps) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [additionalImages, setAdditionalImages] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [existingTemplate, setExistingTemplate] = useState<ExistingTemplate | null>(null)
  const [deployment, setDeployment] = useState<DeploymentData | null>(null)
  const [isPublishingSite, setIsPublishingSite] = useState(false)

  const [cardDesign, setCardDesign] = useState<CardDesignType>("none")
  const [useCardDesign, setUseCardDesign] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const mainImageRef = useRef<HTMLInputElement>(null)
  const additionalImagesRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subscription status
        const creditsRes = await fetch("/api/user/credits")
        if (creditsRes.ok) {
          const creditsData: CreditsData = await creditsRes.json()
          setHasSubscription(creditsData.subscriptionTier !== "none")
        }

        // Fetch deployment
        const deployRes = await fetch(`/api/projects/${projectId}/deployment`)
        if (deployRes.ok) {
          const deployData = await deployRes.json()
          if (deployData.deployment) {
            setDeployment({
              deploymentUrl: deployData.deployment.deploymentUrl,
              updatedAt: deployData.deployment.updatedAt,
            })
          }
        }

        // Fetch existing template for this project
        const templateRes = await fetch(`/api/templates/by-project/${projectId}`)
        if (templateRes.ok) {
          const templateData = await templateRes.json()
          if (templateData.template) {
            const t = templateData.template
            setExistingTemplate(t)
            setTitle(t.title)
            setDescription(t.description)
            setMainImage(t.mainImage)
            setAdditionalImages(t.images || [])
            setTags(t.tags || [])
            setCardDesign(t.cardDesign || "none")
            setUseCardDesign(t.cardDesign !== "none")
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [projectId])

  const handlePublishSite = async () => {
    setIsPublishingSite(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        setDeployment({
          deploymentUrl: data.deploymentUrl,
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error("Failed to deploy:", error)
    } finally {
      setIsPublishingSite(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!existingTemplate) return

    const confirmed = window.confirm("Are you sure you want to delete this template? This action cannot be undone.")
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/templates/${existingTemplate.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setExistingTemplate(null)
        setTitle("")
        setDescription("")
        setMainImage(null)
        setAdditionalImages([])
        setTags([])
        setCardDesign("none")
        setUseCardDesign(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        throw new Error("Failed to delete template")
      }
    } catch (err) {
      setError("Failed to delete template")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMainImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setMainImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAdditionalImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach((file) => {
        if (additionalImages.length < MIN_IMAGES) {
          const reader = new FileReader()
          reader.onloadend = () => {
            setAdditionalImages((prev) => {
              if (prev.length < MIN_IMAGES) {
                return [...prev, reader.result as string]
              }
              return prev
            })
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index))
  }

  const addTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < MAX_TAGS) {
      setTags((prev) => [...prev, trimmedTag])
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    }
  }

  const validateForm = (): string | null => {
    if (!title.trim()) return "Title is required"
    if (!description.trim()) return "Description is required"
    if (!mainImage) return "Main image is required"
    if (additionalImages.length < MIN_IMAGES) return `At least ${MIN_IMAGES} additional images are required`
    if (tags.length === 0) return "At least one tag is required"
    if (!deployment?.deploymentUrl) return "You must publish your site first"
    return null
  }

  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const method = existingTemplate ? "PUT" : "POST"
      const url = existingTemplate ? `/api/templates/${existingTemplate.id}` : "/api/templates"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim(),
          mainImage,
          images: additionalImages,
          tags,
          domain: deployment!.deploymentUrl,
          cardDesign: useCardDesign ? cardDesign : "none",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to publish template")
      }

      const data = await response.json()

      if (!existingTemplate && data.template) {
        setExistingTemplate(data.template)
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish template")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!deployment) {
    return (
    <div className="p-2 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Turn your website into a reusable template</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Share your project as a template for others to use and clone.
          </p>
        </div>

        <Card className="mt-6 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Rocket className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-orange-800">Publish Your Site First</h3>
                <p className="text-sm text-orange-600 mt-1">
                  Before creating a template, you need to publish your site to get a live URL.
                </p>
              </div>
              <Button onClick={handlePublishSite} disabled={isPublishingSite} className="mt-2">
                {isPublishingSite ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Publish Site
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-2 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {existingTemplate ? "Edit Template" : "Publish to Template"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {existingTemplate
            ? "Update your template details below."
            : "Share your project as a template for others to use and clone."}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-green-100 text-green-700 text-sm">
          <Check className="w-4 h-4 flex-shrink-0" />
          {existingTemplate ? "Template updated successfully!" : "Template deleted successfully!"}
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="Enter template title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label>Description *</Label>
        <p className="text-xs text-muted-foreground">Use the formatting toolbar to style your description.</p>
        <RichTextEditor value={description} onChange={setDescription} placeholder="Describe your template..." />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags * (up to {MAX_TAGS})</Label>
        <p className="text-xs text-muted-foreground">
          Add tags to help others find your template (e.g., fitness, e-commerce, portfolio).
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Add a tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={tags.length >= MAX_TAGS}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addTag}
            disabled={!tagInput.trim() || tags.length >= MAX_TAGS}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Main Image */}
      <div className="space-y-2">
        <Label>Main Image *</Label>
        <p className="text-xs text-muted-foreground">This will be the primary image shown in the template gallery.</p>
        <input type="file" ref={mainImageRef} onChange={handleMainImageUpload} accept="image/*" className="hidden" />
        {mainImage ? (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
            <img src={mainImage || "/placeholder.svg"} alt="Main preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setMainImage(null)}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => mainImageRef.current?.click()}
            className="w-full aspect-video h-32 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-8 h-8" />
            <span className="text-sm">Click to upload main image</span>
          </button>
        )}
      </div>

      {/* Additional Images */}
      <div className="space-y-2">
        <Label>Additional Images * (minimum {MIN_IMAGES})</Label>
        <p className="text-xs text-muted-foreground">
          Upload at least {MIN_IMAGES} additional screenshots of your template.
        </p>
        <input
          type="file"
          ref={additionalImagesRef}
          onChange={handleAdditionalImagesUpload}
          accept="image/*"
          multiple
          className="hidden"
        />
        <div className="grid grid-cols-2 gap-3">
          {additionalImages.map((img, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-border">
              <img
                src={img || "/placeholder.svg"}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeAdditionalImage(index)}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {additionalImages.length < MIN_IMAGES && (
            <button
              onClick={() => additionalImagesRef.current?.click()}
              className="aspect-video h-32 w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ImageIcon className="w-6 h-6" />
              <span className="text-xs">
                Add image ({additionalImages.length}/{MIN_IMAGES})
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Badge className="mb-1 ml-[-2px]" variant="secondary">
              Beta
            </Badge>
            <Label>Card Frame Design</Label>
            <p className="text-xs text-muted-foreground">Add a special frame to make your template stand out.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCardDesign}
              onChange={(e) => setUseCardDesign(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Enable frame</span>
            {!hasSubscription && <span className="text-xs bg-[#c15f3c] text-white px-1.5 py-0.5 rounded">Pro</span>}
          </label>
        </div>

        {useCardDesign && (
          <CardDesignSelector selectedDesign={cardDesign} onSelect={setCardDesign} hasSubscription={hasSubscription} />
        )}
      </div>

      <div className="space-y-2">
        <Label>Site URL</Label>
        <p className="text-xs text-muted-foreground">Your published site URL will be used automatically.</p>
        <div className="flex items-center gap-2 p-2 rounded-sm border-[#e4e4e4a8] bg-[#e4e4e4c4]">
          <span className="text-sm text-gray-700 truncate flex-1">{deployment.deploymentUrl}</span>
          <a
            href={deployment.deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        </div>
      </div>

      {/* Submit Button */}
      <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full" size="lg">
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {existingTemplate ? "Updating..." : "Publishing..."}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            {existingTemplate ? "Update Template" : "Publish Template"}
          </>
        )}
      </Button>

      {existingTemplate && (
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <Link
            href={`/templates/${existingTemplate.id}`}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            View your template in the gallery
          </Link>

          <Button
            variant="destructive"
            onClick={handleDeleteTemplate}
            disabled={isDeleting}
            className="w-full"
            size="lg"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Template
              </>
            )}
          </Button>
        </div>
      )}
      <br />
      <br />
      <br />
      <br />
      <br />
    </div>
  )
}
