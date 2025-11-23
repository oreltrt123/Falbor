"use client"

import { useEffect, useRef, useState } from "react"
import { WebContainer } from "@webcontainer/api"

interface PreviewPageProps {
  params: Promise<{
    projectId: string
  }>
}

export default function PreviewPage({ params }: PreviewPageProps) {
  const [projectId, setProjectId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [devServerUrl, setDevServerUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const webContainerRef = useRef<WebContainer | null>(null)

  useEffect(() => {
    params.then(({ projectId }) => {
      setProjectId(projectId)
    })
  }, [params])

  useEffect(() => {
    if (!projectId) return

    const initWebContainer = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log("[v0] Starting WebContainer initialization for project:", projectId)

        // Boot WebContainer instance
        const container = await WebContainer.boot()
        webContainerRef.current = container
        console.log("[v0] WebContainer booted successfully")

        // Fetch project files from API
        const filesResponse = await fetch(`/api/projects/${projectId}/files`)
        if (!filesResponse.ok) {
          throw new Error(`Failed to fetch files: ${filesResponse.statusText}`)
        }

        const { files: projectFiles } = await filesResponse.json()
        console.log("[v0] Fetched", projectFiles.length, "files")

        const fileStructure: Record<string, any> = {}

        projectFiles.forEach((file: { path: string; content: string }) => {
          const parts = file.path.split("/").filter((p) => p.length > 0)
          let current = fileStructure

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const isLastPart = i === parts.length - 1

            if (isLastPart) {
              current[part] = {
                file: {
                  contents: file.content,
                },
              }
            } else {
              if (!current[part]) {
                current[part] = {
                  directory: {},
                }
              }
              if (!current[part].directory) {
                current[part].directory = {}
              }
              current = current[part].directory
            }
          }
        })

        console.log("[v0] File structure prepared")

        // Mount files to WebContainer
        await container.mount(fileStructure)
        console.log("[v0] Files mounted to WebContainer")

        // Check if package.json exists
        const hasPackageJson = projectFiles.some((f: any) => f.path === "package.json")

        if (hasPackageJson) {
          try {
            console.log("[v0] Running npm install...")
            const installProcess = await container.spawn("npm", ["install"], {
              cwd: "/",
            })

            const installExitCode = await installProcess.exit
            console.log(`[v0] npm install exit code: ${installExitCode}`)

            if (installExitCode !== 0) {
              console.warn("[v0] npm install completed with non-zero exit code, continuing...")
            }
          } catch (err) {
            console.warn("[v0] npm install error (non-fatal):", err)
          }

          try {
            console.log("[v0] Starting dev server with npm run dev...")
            const devProcess = await container.spawn("npm", ["run", "dev"], {
              cwd: "/",
            })

            // Listen for server output to find the URL
            let serverUrlFound = false
            const urlTimeout = setTimeout(() => {
              if (!serverUrlFound) {
                console.warn("[v0] Dev server URL not detected in output, using fallback")
                setDevServerUrl("http://localhost:3000")
              }
            }, 15000)

            devProcess.output.pipeTo(
              new WritableStream({
                write(chunk) {
                  const output = chunk.toString()
                  console.log("[v0] Dev server output:", output)

                  // Look for localhost URL pattern
                  if (!serverUrlFound) {
                    const urlMatch = output.match(/http:\/\/localhost:\d+/)
                    if (urlMatch) {
                      serverUrlFound = true
                      clearTimeout(urlTimeout)
                      const url = urlMatch[0]
                      console.log("[v0] Dev server detected at:", url)
                      setDevServerUrl(url)
                    }
                  }
                },
                close() {
                  clearTimeout(urlTimeout)
                },
                abort() {
                  clearTimeout(urlTimeout)
                },
              }),
            )
          } catch (err) {
            console.error("[v0] Failed to start dev server:", err)
            throw new Error("Failed to start development server")
          }
        } else {
          console.warn("[v0] No package.json found, skipping npm install and dev server")
          setError("No package.json found in project. Please add one to enable previews.")
        }

        setLoading(false)
      } catch (err) {
        console.error("[v0] WebContainer initialization error:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize WebContainer")
        setLoading(false)
      }
    }

    initWebContainer()

    // Cleanup on unmount
    return () => {
      if (webContainerRef.current) {
        try {
          webContainerRef.current.teardown()
        } catch (err) {
          console.error("[v0] Teardown error:", err)
        }
      }
    }
  }, [projectId])

  useEffect(() => {
    if (devServerUrl && iframeRef.current) {
      console.log("[v0] Setting iframe src to:", devServerUrl)
      iframeRef.current.src = devServerUrl
    }
  }, [devServerUrl])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-500 mx-auto mb-4"></div>
          {/* <p className="text-gray-700 font-medium">Initializing WebContainer...</p>
          <p className="text-gray-500 text-sm mt-2">This may take a few moments</p> */}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center max-w-md">
          <p className="text-gray-800 font-semibold text-lg mb-2">Preview Error</p>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-white">
      <iframe
        ref={iframeRef}
        src="about:blank"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
        title="WebContainer Preview"
        sandbox="allow-same-origin allow-scripts allow-popups allow-modals allow-forms allow-presentation allow-top-navigation allow-downloads"
      />
    </div>
  )
}