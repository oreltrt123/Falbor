"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Github, Loader2, X, HelpCircle } from "lucide-react"
import { useUser } from "@clerk/nextjs"

interface CreditsData {
  subscriptionTier: string
}

export function GithubClone() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)

  const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [subError, setSubError] = useState("")

  const router = useRouter()
  const { user, isLoaded } = useUser()

  const fetchCredits = async () => {
    if (!user?.id) return
    try {
      const res = await fetch("/api/user/credits")
      if (!res.ok) throw new Error("Failed to fetch credits")
      const data: CreditsData = await res.json()
      setCreditsData(data)
    } catch (err) {
      console.error(err)
      setSubError("Failed to load subscription information")
    }
  }

  // Load credits early (for button + dialog)
  useEffect(() => {
    if (isLoaded && user?.id && !creditsData) {
      fetchCredits()
    }
  }, [isLoaded, user?.id])

  // Optional refresh when dialog opens
  useEffect(() => {
    if (open && isLoaded && user?.id) {
      setLoadingCredits(true)
      setSubError("")
      fetchCredits().finally(() => setLoadingCredits(false))
    }
  }, [open, isLoaded, user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || isLoading) return

    setError("")
    setIsLoading(true)

    try {
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
      if (!match) {
        setError("Invalid GitHub URL")
        return
      }

      const [, owner, repo] = match
      const cleanRepo = repo.replace(/\.git$/, "")

      const res = await fetch("/api/github/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo: cleanRepo, githubUrl: url }),
      })

      if (!res.ok) throw new Error("Clone failed")

      const { projectId } = await res.json()
      router.push(`/chat/${projectId}`)
    } catch (err) {
      setError("Failed to clone repository")
    } finally {
      setIsLoading(false)
    }
  }

  const hasSubscription = creditsData?.subscriptionTier !== "none"

  return (
    <div>
      {/* MAIN BUTTON */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 sm:flex text-sm font-medium cursor-pointer bg-[#e4e4e4a8] hover:bg-[#e4e4e480] border border-[#dbd9d965] py-1 px-4 rounded-4xl text-[#000000] items-center gap-2 w-full sm:w-auto"
        >
        <span className="flex items-center gap-2">
          <Github className="w-4 h-4" />
          <span className="text-sm font-light">Clone from GitHub</span>
        </span>

        {!hasSubscription && (
          <span className="flex items-center gap-1 text-xs font-medium bg-[#c15f3c] ml-2 text-white px-2 py-0.5 rounded-full">
            Pro
          </span>
        )}
      </button>

      {/* DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-[#ffffff] border border-[#ececec50] p-1">
          <DialogTitle className="sr-only">Clone GitHub Repository</DialogTitle>

          <DialogClose className="absolute top-4 right-4 text-black/70 hover:text-black z-10">
            <X className="w-5 h-5" />
          </DialogClose>

          {/* HEADER — ONLY FOR SUBSCRIBED USERS */}
          {hasSubscription && (
            <div className="bg-gradient-to-r rounded-md from-[#c15f3c] via-[#b69d95] to-[#c15f3c] h-32 flex items-center justify-center">
              <Github className="w-16 h-16 text-white" />
            </div>
          )}

          <div className="">
            {/* TITLE — ONLY FOR SUBSCRIBED USERS */}
            {hasSubscription && (
              <div className="text-center">
                <p className="text-black">
                  Clone a GitHub repository using just a URL
                </p>
                <p className="text-black/70 text-sm mt-[-10px]">
                  Turn your repo into a live web app instantly
                </p>
              </div>
            )}

            {loadingCredits ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-black/70" />
            ) : !hasSubscription ? (
              /* 🔒 NO SUBSCRIPTION VIEW */
              <div className="text-center space-y-2 px-3 py-3">
                <p className="text-black">
                  You don’t have a subscription 
                </p>
                <p className="text-black/70 text-sm mt-[-14px]">
                  Upgrade to unlock GitHub cloning
                </p>
                <Button
                  className="w-full bg-[#c15f3c] hover:bg-[#c1603cdc]"
                  onClick={() => {
                    setOpen(false)
                    router.push("/pricing")
                  }}
                >
                  Go to Pricing
                </Button>
              </div>
            ) : (
              /* ✅ FULL GITHUB CLONE UI */
              <form onSubmit={handleSubmit} className="space-y-4 px-3 py-3">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste GitHub repository URL"
                  disabled={isLoading}
                  className="bg-[#ececec] border-[#ececec] text-black"
                />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading || !url.trim()}
                  className="w-full bg-[#c15f3c] hover:bg-[#c1603cdc] text-white py-2 rounded-md"
                >
                  {isLoading ? "Cloning..." : "Clone Repository into Falbor"}
                </button>
                <div className="flex gap-2 text-xs text-black/50">
                  <HelpCircle className="w-3 h-3 mt-0.5" />
                  Copy the URL from the GitHub address bar
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}








// "use client"

// import React, { useState, useEffect } from "react"
// import { useRouter } from "next/navigation"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import {
//   Dialog,
//   DialogContent,
//   DialogTitle,
//   DialogClose,
//   DialogHeader,
//   DialogDescription,
// } from "@/components/ui/dialog"
// import {
//   Github,
//   Loader2,
//   X,
//   HelpCircle,
//   RefreshCw,
//   ExternalLink,
// } from "lucide-react"
// import { useUser } from "@clerk/nextjs"
// import { Card, CardContent } from "@/components/ui/card"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Separator } from "@/components/ui/separator"

// interface Repo {
//   full_name: string
//   name: string
//   description: string | null
//   private: boolean
//   html_url: string
// }

// interface CreditsData {
//   subscriptionTier: string
// }

// export function GithubClone() {
//   const [open, setOpen] = useState(false)
//   const [isConnected, setIsConnected] = useState<boolean | null>(null)
//   const [username, setUsername] = useState<string | null>(null)
//   const [repos, setRepos] = useState<Repo[]>([])
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [cloningRepo, setCloningRepo] = useState<string | null>(null)

//   // Original URL paste states
//   const [url, setUrl] = useState("")
//   const [urlError, setUrlError] = useState("")
//   const [urlLoading, setUrlLoading] = useState(false)

//   const [creditsData, setCreditsData] = useState<CreditsData | null>(null)
//   const [loadingCredits, setLoadingCredits] = useState(false)

//   const router = useRouter()
//   const { user, isLoaded } = useUser()

//   // Load subscription status
//   const fetchCredits = async () => {
//     if (!user?.id) return
//     try {
//       const res = await fetch("/api/user/credits")
//       if (!res.ok) throw new Error("Failed to fetch credits")
//       const data: CreditsData = await res.json()
//       setCreditsData(data)
//     } catch (err) {
//       console.error(err)
//     }
//   }

//   useEffect(() => {
//     if (isLoaded && user?.id && !creditsData) {
//       fetchCredits()
//     }
//   }, [isLoaded, user?.id, creditsData])

//   // Check GitHub connection status when dialog opens
//   useEffect(() => {
//     if (!open || !isLoaded || !user?.id) return

//     const checkConnection = async () => {
//       setLoading(true)
//       setError(null)

//       try {
//         const res = await fetch("/api/github/status")
//         if (!res.ok) throw new Error("Failed to check connection")

//         const data = await res.json()
//         setIsConnected(data.connected)
//         setUsername(data.username || null)

//         if (data.connected) {
//           await loadRepositories()
//         }
//       } catch (err) {
//         setError("Could not check GitHub connection status")
//         console.error(err)
//       } finally {
//         setLoading(false)
//       }
//     }

//     checkConnection()
//   }, [open, isLoaded, user?.id])

//   const loadRepositories = async () => {
//     setLoading(true)
//     setError(null)

//     try {
//       const res = await fetch("/api/github/repos")
//       if (!res.ok) {
//         if (res.status === 401) {
//           setIsConnected(false)
//           throw new Error("GitHub session expired")
//         }
//         throw new Error("Failed to load repositories")
//       }

//       const { repos } = await res.json()
//       setRepos(repos || [])
//     } catch (err: any) {
//       setError(err.message || "Failed to load your repositories")
//     } finally {
//       setLoading(false)
//     }
//   }

//   const handleConnect = () => {
//     // You can add ?redirectTo= current page if you want to come back
//     window.location.href = "/api/github/connect"
//   }

//   const handleCloneRepo = async (repo: Repo) => {
//     if (cloningRepo) return

//     setCloningRepo(repo.full_name)
//     setError(null)

//     try {
//       const [owner, repoName] = repo.full_name.split('/')
//       const res = await fetch("/api/github/clone", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ 
//           owner,
//           repo: repoName,
//           githubUrl: repo.html_url 
//         }),
//       })

//       if (!res.ok) {
//         const errData = await res.json()
//         throw new Error(errData.error || "Clone failed")
//       }

//       const { projectId } = await res.json()
//       router.push(`/chat/${projectId}`)
//       setOpen(false)
//     } catch (err: any) {
//       setError(err.message || "Failed to clone repository")
//     } finally {
//       setCloningRepo(null)
//     }
//   }

//   const handleUrlClone = async (e: React.FormEvent) => {
//     e.preventDefault()
//     if (!url.trim() || urlLoading) return

//     setUrlError("")
//     setUrlLoading(true)

//     try {
//       const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
//       if (!match) {
//         setUrlError("Invalid GitHub URL")
//         return
//       }

//       const [, owner, repo] = match
//       const cleanRepo = repo.replace(/\.git$/, "")

//       const res = await fetch("/api/github/clone", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ owner, repo: cleanRepo, githubUrl: url }),
//       })

//       if (!res.ok) throw new Error("Clone failed")

//       const { projectId } = await res.json()
//       router.push(`/chat/${projectId}`)
//       setOpen(false)
//     } catch (err) {
//       setUrlError("Failed to clone repository")
//     } finally {
//       setUrlLoading(false)
//     }
//   }

//   const hasSubscription = creditsData?.subscriptionTier !== "none"

//   return (
//     <>
//       {/* Trigger Button */}
//       <button
//         type="button"
//         onClick={() => setOpen(true)}
//         className="hidden h-8 sm:flex text-sm font-medium cursor-pointer bg-[#e4e4e4a8] hover:bg-[#e4e4e480] border border-[#dbd9d965] py-1 px-4 rounded-4xl text-[#000000] items-center gap-2 w-full sm:w-auto"
//       >
//         <Github className="w-4 h-4" />
//         <span className="text-sm font-light">Clone from GitHub</span>

//         {!hasSubscription && (
//           <span className="flex items-center gap-1 text-xs font-medium bg-[#c15f3c] ml-2 text-white px-2 py-0.5 rounded-full">
//             Pro
//           </span>
//         )}
//       </button>

//       {/* Dialog */}
//       <Dialog open={open} onOpenChange={setOpen}>
//         <DialogContent className="sm:max-w-lg bg-white border border-gray-200 p-0 max-h-[90vh] flex flex-col">
//           <DialogClose className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-900">
//             <X className="w-5 h-5" />
//           </DialogClose>

//           {hasSubscription ? (
//             <>
//               <DialogHeader className="px-6 pt-6 pb-4 border-b">
//                 <div className="flex items-center gap-3">
//                   <Github className="w-8 h-8 text-gray-900" />
//                   <div>
//                     <DialogTitle className="text-xl font-semibold">
//                       Clone from GitHub
//                     </DialogTitle>
//                     <DialogDescription className="text-sm text-gray-600 mt-1">
//                       Paste a URL or select from your connected repositories
//                     </DialogDescription>
//                   </div>
//                 </div>
//               </DialogHeader>

//               <div className="flex-1 overflow-hidden flex flex-col space-y-6">
//                 {/* URL Paste Section */}
//                 <div className="space-y-4 px-4">
//                   <form onSubmit={handleUrlClone} className="space-y-3">
//                     <Input
//                       value={url}
//                       onChange={(e) => setUrl(e.target.value)}
//                       placeholder="Paste GitHub repository URL"
//                       disabled={urlLoading}
//                       className="bg-gray-100 border-gray-300 text-black"
//                     />
//                     {urlError && <p className="text-red-500 text-sm">{urlError}</p>}
//                     <Button
//                       type="submit"
//                       disabled={urlLoading || !url.trim()}
//                       className="w-full bg-[#c15f3c] hover:bg-[#c1603cdc] text-white"
//                     >
//                       {urlLoading ? (
//                         <Loader2 className="w-4 h-4 animate-spin mr-2" />
//                       ) : null}
//                       {urlLoading ? "Cloning..." : "Clone from URL"}
//                     </Button>
//                   </form>
//                   <div className="flex items-center gap-2 text-xs text-gray-500">
//                     <HelpCircle className="w-3 h-3" />
//                     Copy the URL from the GitHub address bar
//                   </div>
//                 </div>

//                 <Separator />

//                 {/* Repositories List Section */}
//                 {loading ? (
//                   <div className="flex items-center justify-center py-8">
//                     <Loader2 className="w-8 h-8 animate-spin text-[#c15f3c]" />
//                   </div>
//                 ) : error ? (
//                   <div className="text-center py-8 text-red-600">
//                     <p className="font-medium">{error}</p>
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       className="mt-4"
//                       onClick={() => {
//                         setError(null)
//                         if (isConnected) loadRepositories()
//                       }}
//                     >
//                       Try Again
//                     </Button>
//                   </div>
//                 ) : isConnected === null ? null : !isConnected ? (
//                   <div className="flex flex-col items-center justify-center gap-6 py-8">
//                     <Github className="w-16 h-16 text-gray-400" />
//                     <div className="text-center max-w-sm">
//                       <h3 className="text-lg font-semibold mb-2">
//                         Connect your GitHub account
//                       </h3>
//                       <p className="text-sm text-gray-600 mb-6">
//                         Authorize Falbor to access your repositories so you can clone them easily.
//                       </p>
//                       <Button
//                         onClick={handleConnect}
//                         className="bg-gray-900 hover:bg-gray-800 text-white"
//                       >
//                         Connect GitHub
//                       </Button>
//                     </div>
//                   </div>
//                 ) : (
//                   <>
//                     <div className="flex items-center justify-between mb-4 px-4">
//                       <p className="text-sm text-gray-600">
//                         Connected as <strong>{username || "you"}</strong> • Your Repositories
//                       </p>
//                       <div className="flex gap-2">
//                         <Button
//                           variant="ghost"
//                           size="sm"
//                           onClick={loadRepositories}
//                           disabled={loading}
//                         >
//                           <RefreshCw className="w-4 h-4 mr-1.5" />
//                           Refresh
//                         </Button>
//                       </div>
//                     </div>

//                     {repos.length === 0 ? (
//                       <div className="flex flex-col items-center justify-center text-center py-8">
//                         <p className="text-gray-500 mb-2">No repositories found</p>
//                         <p className="text-sm text-gray-400">
//                           You might not have any public repositories, or your account is empty.
//                         </p>
//                       </div>
//                     ) : (
//                       <ScrollArea className="flex-1 -mx-2 px-2 overflow-auto">
//                         <div className="space-y-3"> {/* Added space-y-3 for gaps between cards */}
//                           {repos.map((repo) => (
//                             <Card
//                               key={repo.full_name}
//                               className="hover:border-[#c15f3c]/50 transition-colors cursor-pointer"
//                               onClick={() => handleCloneRepo(repo)}
//                             >
//                               <CardContent className="p-4 flex items-start justify-between gap-4">
//                                 <div className="min-w-0 flex-1">
//                                   <div className="flex items-center gap-2 mb-1">
//                                     <p className="font-medium truncate">{repo.full_name}</p>
//                                     {repo.private && (
//                                       <span className="text-xs px-2 py-0.5 bg-gray-200 rounded-full">
//                                         Private
//                                       </span>
//                                     )}
//                                   </div>
//                                   {repo.description && (
//                                     <p className="text-sm text-gray-600 line-clamp-2">
//                                       {repo.description}
//                                     </p>
//                                   )}
//                                 </div>

//                                 {cloningRepo === repo.full_name ? (
//                                   <Loader2 className="w-5 h-5 animate-spin text-[#c15f3c] shrink-0" />
//                                 ) : (
//                                   <Button
//                                     variant="outline"
//                                     size="sm"
//                                     className="shrink-0"
//                                   >
//                                     Clone
//                                   </Button>
//                                 )}
//                               </CardContent>
//                             </Card>
//                           ))}
//                         </div>
//                       </ScrollArea>
//                     )}
//                   </>
//                 )}
//               </div>
//             </>
//           ) : (
//             // No subscription view (unchanged logic)
//             <div className="p-6 text-center space-y-4">
//               <p className="font-medium">GitHub Cloning is a Pro feature</p>
//               <p className="text-sm text-gray-600">
//                 Upgrade your plan to clone repositories directly from GitHub.
//               </p>
//               <Button
//                 className="bg-[#c15f3c] hover:bg-[#c1603cdc] text-white"
//                 onClick={() => {
//                   setOpen(false)
//                   router.push("/pricing")
//                 }}
//               >
//                 View Pricing
//               </Button>
//             </div>
//           )}

//           <div className="px-6 py-4 border-t text-xs text-gray-500 flex items-center gap-2 ro">
//             <HelpCircle className="w-3.5 h-3.5" />
//             <span>
//               Only public repositories are shown unless you grant additional permissions
//             </span>
//           </div>
//         </DialogContent>
//       </Dialog>
//     </>
//   )
// }