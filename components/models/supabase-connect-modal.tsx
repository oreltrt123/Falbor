// components/supabase-connect-modal.tsx
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Database, Loader2, Check, ChevronRight, Eye, EyeOff, ArrowLeft } from "lucide-react"

interface SupabaseProject {
  ref: string
  name: string
  organization_name?: string | null
  region?: string | null
}

interface SupabaseOrganization {
  id: string
  name: string
}

interface DatabaseCredentials {
  supabaseUrl: string
  anonKey: string
}

interface SupabaseConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credentialsSaved: boolean
  databaseCredentials: DatabaseCredentials
  selectedProjectRef: string
  projects: SupabaseProject[]
  onDisconnect: () => void
  onConnect: (credentials: DatabaseCredentials, projectRef: string, projectName: string, accessToken: string) => void
  isAuthenticated: boolean
}

export function SupabaseConnectModal({
  open,
  onOpenChange,
  credentialsSaved,
  databaseCredentials,
  selectedProjectRef,
  projects,
  onDisconnect,
  onConnect,
  isAuthenticated,
}: SupabaseConnectModalProps) {
  const [accessToken, setAccessToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([])
  const [availableProjects, setAvailableProjects] = useState<SupabaseProject[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string>("")
  const [localSelectedProject, setLocalSelectedProject] = useState<string>("")
  const [isValidating, setIsValidating] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isFetchingApiKeys, setIsFetchingApiKeys] = useState(false)
  const [isSavingCredentials, setIsSavingCredentials] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedCredentials, setFetchedCredentials] = useState<DatabaseCredentials | null>(null)
  const [step, setStep] = useState<"token" | "select-org" | "select-project" | "confirm">("token")

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      if (!credentialsSaved) {
        setAccessToken("")
        setOrganizations([])
        setAvailableProjects([])
        setSelectedOrg("")
        setLocalSelectedProject("")
        setFetchedCredentials(null)
        setStep("token")
        setError(null)
      }
    }
  }, [open, credentialsSaved])

  const handleValidateToken = async () => {
    if (!accessToken.trim()) {
      setError("Please enter your Personal Access Token")
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const response = await fetch("/api/supabase/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error("Invalid token. Please check your Personal Access Token.")
        }
        throw new Error(errorData.error || "Failed to validate token")
      }

      const orgs = await response.json()
      setOrganizations(orgs)
      setStep("select-org")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate token")
    } finally {
      setIsValidating(false)
    }
  }

  const fetchProjects = async (orgId: string) => {
    setIsLoadingProjects(true)
    setError(null)
    try {
      const response = await fetch("/api/supabase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, orgId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch projects")
      }

      const projects = await response.json()
      setAvailableProjects(
        projects.map((p: any) => ({
          ref: p.id,
          name: p.name,
          region: p.region,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const fetchApiKeysForProject = async (projectRef: string) => {
    setIsFetchingApiKeys(true)
    setError(null)
    try {
      const res = await fetch("/api/supabase/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, projectRef }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch API keys")
      }
      const data = await res.json()
      setFetchedCredentials({
        supabaseUrl: data.supabaseUrl,
        anonKey: data.anonKey,
      })
      setStep("confirm")
    } catch (err) {
      console.error("Failed to fetch API keys:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch API keys")
    } finally {
      setIsFetchingApiKeys(false)
    }
  }

  const handleSelectOrg = async (orgId: string) => {
    setSelectedOrg(orgId)
    await fetchProjects(orgId)
    setStep("select-project")
  }

  const handleSelectProject = async (projectRef: string) => {
    setLocalSelectedProject(projectRef)
    await fetchApiKeysForProject(projectRef)
  }

  const handleSaveConnection = async () => {
    if (!fetchedCredentials || !localSelectedProject) return
    const selectedProject = availableProjects.find((p) => p.ref === localSelectedProject)
    setIsSavingCredentials(true)
    try {
      const res = await fetch("/api/user/supabase-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          selectedProjectRef: localSelectedProject,
          selectedProjectName: selectedProject?.name,
          supabaseUrl: fetchedCredentials.supabaseUrl,
          anonKey: fetchedCredentials.anonKey,
        }),
      })
      if (res.ok) {
        onConnect(fetchedCredentials, localSelectedProject, selectedProject?.name || "", accessToken)
        onOpenChange(false)
      } else {
        const error = await res.json()
        setError(error.message || "Failed to save credentials")
      }
    } catch (err) {
      console.error("Failed to save credentials:", err)
      setError("Failed to save credentials. Please try again.")
    } finally {
      setIsSavingCredentials(false)
    }
  }

  const handleBack = () => {
    setError(null)
    if (step === "select-project") {
      setStep("select-org")
      setAvailableProjects([])
      setLocalSelectedProject("")
    } else if (step === "confirm") {
      setStep("select-project")
      setFetchedCredentials(null)
    } else if (step === "select-org") {
      setOrganizations([])
      setStep("token")
    }
  }

  const renderContent = () => {
    if (credentialsSaved) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-950/20 p-3 rounded-md">
            <Check className="w-5 h-5" />
            <div>
              <p className="font-medium">Database connected successfully</p>
              {selectedProjectRef && (
                <p className="text-xs text-green-700 mt-1">
                  Project: {projects.find((p) => p.ref === selectedProjectRef)?.name || selectedProjectRef}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>VITE_SUPABASE_URL:</strong>
            </p>
            <code className="block bg-muted p-2 rounded text-xs break-all">{databaseCredentials.supabaseUrl}</code>
            <p>
              <strong>VITE_SUPABASE_ANON_KEY:</strong>
            </p>
            <code className="block bg-muted p-2 rounded text-xs break-all">
              {databaseCredentials.anonKey.substring(0, 30)}...
            </code>
          </div>
          <Button variant="destructive" onClick={onDisconnect} className="w-full">
            Disconnect Database
          </Button>
        </div>
      )
    }

    switch (step) {
      case "token":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your Supabase Personal Access Token to connect your database. You can generate one from your{" "}
              <a
                href="https://supabase.com/dashboard/account/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Supabase account settings
              </a>
              .
            </p>

            <div className="space-y-2">
              <Label htmlFor="access-token">Personal Access Token</Label>
              <div className="relative">
                <Input
                  id="access-token"
                  type={showToken ? "text" : "password"}
                  placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleValidateToken()
                  }}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                Your token gives access to all your organizations and projects. It is stored securely and only used to
                manage your database.
              </p>
            </div>

            <Button onClick={handleValidateToken} disabled={isValidating || !accessToken.trim()} className="w-full">
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        )

      case "select-org":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600">Token validated successfully</span>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Select an Organization</Label>
              {organizations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No organizations found.</p>
                  <p className="text-xs mt-1">Create an organization in Supabase first.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className="font-medium">{org.name}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="outline" onClick={handleBack} className="w-full bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        )

      case "select-project":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <span className="text-sm text-muted-foreground">
                Organization: <strong>{organizations.find((o) => o.id === selectedOrg)?.name}</strong>
              </span>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Select a Project</Label>
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No projects found in this organization.</p>
                  <p className="text-xs mt-1">Create a project in Supabase first.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableProjects.map((project) => (
                    <button
                      key={project.ref}
                      onClick={() => handleSelectProject(project.ref)}
                      disabled={isFetchingApiKeys}
                      className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                    >
                      <div>
                        <span className="font-medium block">{project.name}</span>
                        {project.region && <span className="text-xs text-muted-foreground">{project.region}</span>}
                      </div>
                      {isFetchingApiKeys && localSelectedProject === project.ref ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="outline" onClick={handleBack} className="w-full bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        )

      case "confirm":
        const selectedProject = availableProjects.find((p) => p.ref === localSelectedProject)
        return (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="w-5 h-5" />
                <span className="font-medium">Ready to Connect</span>
              </div>
              <div className="text-sm text-green-800 dark:text-green-300 space-y-1">
                <p>
                  <strong>Project:</strong> {selectedProject?.name}
                </p>
                {selectedProject?.region && (
                  <p>
                    <strong>Region:</strong> {selectedProject.region}
                  </p>
                )}
              </div>
            </div>

            {fetchedCredentials && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                <p className="text-xs font-medium text-muted-foreground">API Credentials Retrieved:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="break-all">
                    <strong>URL:</strong> {fetchedCredentials.supabaseUrl}
                  </p>
                  <p>
                    <strong>Anon Key:</strong> {fetchedCredentials.anonKey.substring(0, 20)}...
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1 bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleSaveConnection} disabled={isSavingCredentials} className="flex-1">
                {isSavingCredentials ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Database"
                )}
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          Connect Database
        </DialogTitle>
        <div className="space-y-4 mt-4">
          {error && <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md">{error}</div>}
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}