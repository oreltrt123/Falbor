"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Heart,
  Eye,
  Share2,
  Flag,
  Sparkles,
  Check,
} from "lucide-react"
import Link from "next/link"
import { CardFrame, type CardDesignType } from "./card-designs"

interface TemplateData {
  id: string
  projectId: string
  title: string
  description: string
  tags: string[]
  mainImage: string
  images: string[]
  domain: string
  creatorId: string
  createdAt: Date
  creatorName: string
  creatorImage: string | null
  projectTitle: string
  cardDesign?: CardDesignType
  views?: number
  clones?: number
  likes?: number
  isFeatured?: boolean
  isLiked?: boolean
}

interface TemplateDetailProps {
  template: TemplateData
}

export function TemplateDetail({ template }: TemplateDetailProps) {
  const router = useRouter()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isCloning, setIsCloning] = useState(false)
  const [isLiked, setIsLiked] = useState(template.isLiked || false)
  const [likeCount, setLikeCount] = useState(template.likes || 0)
  const [copied, setCopied] = useState(false)

  const allImages = [template.mainImage, ...template.images]

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length)
  }

  const handleClone = async () => {
    setIsCloning(true)
    try {
      const response = await fetch("/api/templates/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      })

      if (!response.ok) {
        throw new Error("Failed to clone template")
      }

      const data = await response.json()
      router.push(`/chat/${data.projectId}`)
    } catch (error) {
      console.error("Clone error:", error)
      setIsCloning(false)
    }
  }

  const handleViewSite = () => {
    window.open(template.domain, "_blank")
  }

  const handleLike = async () => {
    setIsLiked(!isLiked)
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1))

    try {
      await fetch(`/api/templates/${template.id}/like`, {
        method: isLiked ? "DELETE" : "POST",
      })
    } catch (error) {
      setIsLiked(isLiked)
      setLikeCount((prev) => (isLiked ? prev + 1 : prev - 1))
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background mt-10">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Slider */}
          <div className="space-y-4">
            <CardFrame design={template.cardDesign || "none"}>
              <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={allImages[currentImageIndex] || "/placeholder.svg"}
                  alt={`${template.title} preview ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />

                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/50 text-white text-sm">
                  {currentImageIndex + 1} / {allImages.length}
                </div>

                {template.isFeatured && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-yellow-500 text-black text-xs font-medium rounded-full">
                    <Sparkles className="w-3 h-3" />
                    Featured Template
                  </div>
                )}
              </div>
            </CardFrame>

            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-14 rounded-md overflow-hidden border-2 transition-colors ${
                      currentImageIndex === index ? "border-primary" : "border-transparent hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={img || "/placeholder.svg"}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-b py-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {template.views || 0} views
                </div>
                <div className="flex items-center gap-1">
                  <Copy className="w-4 h-4" />
                  {template.clones || 0} clones
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleLike} className={isLiked ? "text-red-500" : ""}>
                  <Heart className={`w-4 h-4 mr-1 ${isLiked ? "fill-current" : ""}`} />
                  {likeCount}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShare}>
                  {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm">
                  <Flag className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={template.creatorImage || undefined} />
                <AvatarFallback>{template.creatorName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Created by</p>
                <p className="font-medium text-foreground">{template.creatorName}</p>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-foreground">{template.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">Published on {formatDate(template.createdAt)}</p>
            </div>

            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Description</h2>
              <div
                className="text-foreground leading-relaxed prose prose-sm max-w-none
                  [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600
                  [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-red-600
                  [&_a]:text-blue-600 [&_a]:underline
                  [&_ol]:list-decimal [&_ol]:pl-5
                  [&_ul]:list-disc [&_ul]:pl-5
                  [&_b]:font-bold [&_strong]:font-bold
                  [&_i]:italic [&_em]:italic
                  [&_u]:underline
                  [&_s]:line-through [&_strike]:line-through"
                dangerouslySetInnerHTML={{ __html: template.description }}
              />
            </div>

            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button onClick={handleViewSite} variant="outline" className="bg-gray-300 hover:bg-gray-200 text-black flex-1">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Site
              </Button>
              <Button onClick={handleClone} disabled={isCloning} className="flex-1">
                {isCloning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Clone Template
                  </>
                )}
              </Button>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-medium">Community</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold">{template.clones || 0}</div>
                  <div className="text-sm text-muted-foreground">Projects Built</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold">{likeCount}</div>
                  <div className="text-sm text-muted-foreground">Likes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
