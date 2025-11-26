let webcontainerInstance: any = null
let bootPromise: Promise<any> | null = null

export async function getWebContainerInstance() {
  if (webcontainerInstance) {
    return webcontainerInstance
  }

  if (bootPromise) {
    return bootPromise
  }

  bootPromise = (async () => {
    try {
      const { WebContainer } = await import("@webcontainer/api")
      webcontainerInstance = await WebContainer.boot()
      console.log("[v0] WebContainer booted successfully")
      return webcontainerInstance
    } catch (error) {
      console.error("[v0] WebContainer boot error:", error)
      bootPromise = null
      throw error
    }
  })()

  return bootPromise
}

export function resetWebContainer() {
  webcontainerInstance = null
  bootPromise = null
}
