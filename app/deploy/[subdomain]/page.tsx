
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react"
import { db } from "@/config/db"
import { deployments, files, projects, userCredits } from "@/config/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"

export default async function DeployPage({
    params,
}: {
    params: Promise<{ subdomain: string }>
}) {
    const { subdomain } = await params

    const [deployment] = await db.select().from(deployments).where(eq(deployments.subdomain, subdomain)).limit(1)

    if (!deployment) {
        notFound()
    }

    const [project] = await db
        .select({ userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, deployment.projectId))
        .limit(1)

    if (!project) {
        notFound()
    }

    const [ownerCredits] = await db
        .select({ subscriptionTier: userCredits.subscriptionTier })
        .from(userCredits)
        .where(eq(userCredits.userId, project.userId))
        .limit(1)

    const hasSubscription = ownerCredits?.subscriptionTier !== "none"

    const projectFiles = await db.select().from(files).where(eq(files.projectId, deployment.projectId))

    if (!projectFiles.length) {
        return <div className="flex h-screen items-center justify-center text-xl">No files available</div>
    }

    const hasPy = projectFiles.some((f) => f.path.endsWith(".py"))
    const hasJsTs = projectFiles.some((f) => /\.(js|jsx|ts|tsx)$/.test(f.path))

    if (hasPy && !hasJsTs) {
        return <div className="flex h-screen items-center justify-center text-xl">Python deployment not supported yet</div>
    }

    if (!hasJsTs) {
        return <div className="flex h-screen items-center justify-center text-xl">Unsupported project type</div>
    }

    const sandpackFiles = projectFiles.reduce<Record<string, string>>((acc, file) => {
        acc[`/${file.path.replace(/^\/+/, "")}`] = file.content
        return acc
    }, {})

    const hasTs = projectFiles.some((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"))

    return (
        <div className="relative h-screen">
            <SandpackProvider
                template={hasTs ? "react-ts" : "react"}
                files={sandpackFiles}
                customSetup={{
                    dependencies: {
                        react: "^18.2.0",
                        "react-dom": "^18.2.0",
                    },
                }}
                options={{
                    externalResources: ["https://cdn.tailwindcss.com"],
                    initMode: "lazy",
                }}
            >
                <SandpackPreview
                    style={{ height: "100vh" }}
                    showOpenInCodeSandbox={false}
                    showRefreshButton={false}
                    showNavigator={false}
                    showOpenNewtab={false}
                />
            </SandpackProvider>

            {!hasSubscription && (
                <div className="absolute h-12 bottom-0 right-2 flex justify-center py-2 bg-white/80 text-center">
                    <button className="bg-black/90 text-white px-4 py-1 rounded-sm text-sm font-medium flex items-center">
                        <span className="mt-[-3px] font-semibold">Made in</span>
                        <img src="/logo.png" width={80} alt="" className="ml-[2px]" />
                    </button>
                </div>
            )}
        </div>
    )
}
