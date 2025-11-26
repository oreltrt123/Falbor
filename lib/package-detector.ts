export function detectPackagesFromFiles(files: { path: string; content: string }[]): string[] {
  const packages = new Set<string>()

  // Common package patterns to detect
  const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g
  const requireRegex = /require\s*$$\s*['"]([^'"]+)['"]\s*$$/g

  files.forEach((file) => {
    // Skip non-JS/TS files
    if (!file.path.match(/\.(tsx?|jsx?|mjs|cjs)$/)) return

    const content = file.content

    // Find all imports
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]

      // Skip relative imports and built-in Node modules
      if (importPath.startsWith(".") || importPath.startsWith("/")) continue
      if (["fs", "path", "http", "https", "crypto", "os", "util", "stream"].includes(importPath)) continue

      // Extract package name (handle scoped packages)
      const packageName = importPath.startsWith("@")
        ? importPath.split("/").slice(0, 2).join("/")
        : importPath.split("/")[0]

      packages.add(packageName)
    }

    // Find all requires
    while ((match = requireRegex.exec(content)) !== null) {
      const requirePath = match[1]

      if (requirePath.startsWith(".") || requirePath.startsWith("/")) continue
      if (["fs", "path", "http", "https", "crypto", "os", "util", "stream"].includes(requirePath)) continue

      const packageName = requirePath.startsWith("@")
        ? requirePath.split("/").slice(0, 2).join("/")
        : requirePath.split("/")[0]

      packages.add(packageName)
    }
  })

  // Filter out packages that are typically included by default
  const defaultPackages = ["react", "react-dom", "next"]

  return Array.from(packages).filter((pkg) => !defaultPackages.includes(pkg))
}

export function getPackageInstallCommand(packages: string[]): string {
  if (packages.length === 0) return ""
  return `npm install ${packages.join(" ")}`
}