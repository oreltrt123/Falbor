"use client"
import React, { useState } from "react"
import { useSignIn } from "@clerk/nextjs"
import type { OAuthStrategy } from "@clerk/types"
import Link from "next/link"
import RotatingEarth from "@/components/ui/dotted-globe";

export default function Page() {
  const { signIn, isLoaded, setActive } = useSignIn()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  const GITHUB_CANDIDATES = ["oauth_github", "oauth_github_oauth_app"]
  const GOOGLE_CANDIDATES = ["oauth_google", "oauth_google_oauth_app"]

  async function tryStrategies(candidates: string[]): Promise<void> {
    if (!isLoaded || !signIn) throw new Error("SignIn not loaded")
    let lastError: any = null

    for (const s of candidates) {
      try {
        await signIn.authenticateWithRedirect({
          strategy: s as OAuthStrategy,
          redirectUrl: "/sso-callback",
          redirectUrlComplete: "/",
        })
        return
      } catch (err: any) {
        lastError = err
      }
    }
    throw lastError ?? new Error("No strategy succeeded")
  }

  const handleOAuthGithub = async (): Promise<void> => {
    setError(null)
    setLoadingProvider("github")
    try {
      await tryStrategies(GITHUB_CANDIDATES)
    } catch (err: any) {
      setError("GitHub sign-in failed.")
      setLoadingProvider(null)
    }
  }

  const handleOAuthGoogle = async (): Promise<void> => {
    setError(null)
    setLoadingProvider("google")
    try {
      await tryStrategies(GOOGLE_CANDIDATES)
    } catch (err: any) {
      setError("Google sign-in failed.")
      setLoadingProvider(null)
    }
  }

  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (!isLoaded || !signIn) {
      setError("Auth system not ready")
      return
    }
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        window.location.href = "/"
        return
      }
      setError("Sign-in needs more steps.")
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? err?.message ?? "Sign-in failed")
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#161616] overflow-x-hidden overflow-y-hidden">
      {/* Login Form */}
      <div className="w-full max-w-xs rounded-xl p-6 bg-transparent -translate-x-16 mr-40">
        <h1 className="text-2xl font-light text-center text-white">Welcome to Falbor</h1>
        <h1 className="text-2xl font-light text-center mb-4 text-[#939494]">Start building now</h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Email"
            className="px-3 py-1 text-[13px] border border-[#272727] focus:border-[#65c0fc57] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="px-3 py-1 text-[13px] border border-[#272727] focus:border-[#65c0fc57] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="text-red-500 text-xs text-center">{error}</div>}
          <button className="mt-2 bg-[#0099FF] text-white py-1 rounded-md text-sm cursor-pointer">Log in</button>
        </form>

        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={handleOAuthGoogle}
            className="flex items-center justify-center gap-2 rounded-md py-1 bg-[#272727] hover:bg-[#2e2d2d] text-[#bec2c2] text-sm cursor-pointer"
            disabled={loadingProvider !== null}
          >
            <img alt="Google" src="/googlelogo.png" className="w-4 h-4" />
            {loadingProvider === "google" ? "Opening..." : "Google"}
          </button>
          <button
            onClick={handleOAuthGithub}
            className="flex items-center justify-center gap-2 rounded-md py-1 bg-[#272727] hover:bg-[#2e2d2d] text-[#bec2c2] text-sm cursor-pointer"
            disabled={loadingProvider !== null}
          >
            <img alt="GitHub" src="/githublogo.png" className="w-4 h-4" />
            {loadingProvider === "github" ? "Opening..." : "GitHub"}
          </button>
        </div>

        <p className="text-center text-xs text-[#939494] mt-4">
          New in Falbor? <Link href={'/sign-up'} className="text-[#0099ffc7]">Sign up</Link>
        </p>
      </div>

      {/* Globe on the right side */}
      <div className="absolute inset-y-0 right-0 z-0 flex items-center pr-4">
        <div className="relative left-120 top-[130px] w-[600px] h-[600px] sm:w-[700px] sm:h-[700px] md:w-[800px] md:h-[800px] lg:w-[900px] lg:h-[900px]">
          <RotatingEarth className="absolute inset-0 w-full h-full opacity-80" />
        </div>
      </div>
    </div>
  )
}
