"use client"
import React, { useState, useEffect } from "react"
import { useSignUp } from "@clerk/nextjs"
import type { OAuthStrategy } from "@clerk/types"
import Link from "next/link"
import { Globe } from "@/components/ui/globe"

export default function Page() {
  const { signUp, isLoaded, setActive } = useSignUp()
  const [step, setStep] = useState<'form' | 'missing' | 'verify'>('form')
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])

  // Dynamically determine required fields
  const [requiredFields, setRequiredFields] = useState<string[]>([])
  const [showUsername, setShowUsername] = useState(false)
  const [showPhone, setShowPhone] = useState(false)

  useEffect(() => {
    if (isLoaded && signUp) {
      const req = signUp.requiredFields || []
      setRequiredFields(req.map((f: any) => f.path))
      setShowUsername(req.some((f: any) => f.path === 'username'))
      setShowPhone(req.some((f: any) => f.path === 'phone_number'))
      console.log("Required fields from Clerk:", req)
    }
  }, [isLoaded, signUp])

  // Candidate strategies for OAuth
  const GITHUB_CANDIDATES = ["oauth_github", "oauth_github_oauth_app"]
  const GOOGLE_CANDIDATES = ["oauth_google", "oauth_google_oauth_app"]

  async function tryStrategies(candidates: string[], redirectUrl = "/sso-callback", redirectUrlComplete = "/"): Promise<void> {
    if (!isLoaded || !signUp) throw new Error("SignUp not loaded")
    let lastError: any = null
    for (const s of candidates) {
      try {
        await signUp.authenticateWithRedirect({
          strategy: s as OAuthStrategy,
          redirectUrl,
          redirectUrlComplete,
        })
        return
      } catch (err: any) {
        lastError = err
        console.warn(`Strategy ${s} failed:`, err?.message ?? err)
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
      setError("GitHub sign-up failed. Check Clerk Dashboard > Social Connections.")
      setLoadingProvider(null)
    }
  }

  const handleOAuthGoogle = async (): Promise<void> => {
    setError(null)
    setLoadingProvider("google")
    try {
      await tryStrategies(GOOGLE_CANDIDATES)
    } catch (err: any) {
      setError("Google sign-up failed. Check Clerk Dashboard > Social Connections.")
      setLoadingProvider(null)
    }
  }

  // Progressive update for missing fields
  const updateMissingFields = async (): Promise<void> => {
    if (!signUp || step !== 'missing') return
    const updateData: any = {}
    if (missingFields.includes('username') && username) updateData.username = username
    if (missingFields.includes('phone_number') && phone) updateData.phoneNumber = phone
    // Add custom fields here if needed, e.g., unsafeMetadata: { terms: true }

    try {
      const updateResult = await signUp.update(updateData)
      console.log("Update result:", updateResult)
      if (updateResult.status === 'complete') {
        await setActive({ session: updateResult.createdSessionId })
        window.location.href = "/"
      } else if (updateResult.missingFields?.length) {
        setMissingFields(updateResult.missingFields)
        setError(`Still missing: ${updateResult.missingFields.join(', ')}`)
      } else {
        setStep('verify') // Move to verification if no missing
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Update failed")
    }
  }

  const handleSignUp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    if (!isLoaded || !signUp) {
      setError("Auth system not ready")
      setLoading(false)
      return
    }

    try {
      const createData: any = {
        firstName,
        lastName,
        emailAddress: email,
        password,
      }
      if (showUsername) createData.username = username
      if (showPhone) createData.phoneNumber = phone

      const result = await signUp.create(createData)
      console.log("Create result:", result) // Debug full object

      switch (result.status) {
        case "complete":
          await setActive({ session: result.createdSessionId })
          window.location.href = "/"
          return
        case "missing_requirements":
          const missing = result.missingFields || []
          const unverified = result.unverifiedFields || []
          console.log("Missing:", missing, "Unverified:", unverified)
          setMissingFields(missing)
          if (missing.length > 0) {
            setStep('missing')
            setError(`Please complete: ${missing.join(', ')}`)
          } else if (unverified.length > 0) {
            setStep('verify')
            // Prep verification for unverified (e.g., email)
            if (unverified.includes('email_address')) {
              await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
              setError("Check your email for verification code.")
            }
            // Add handling for other unverified fields if needed (e.g., phone: preparePhoneNumberVerification)
          }
          break
        default:
          setError(`Status: ${result.status}. Check console.`)
      }
    } catch (err: any) {
      console.error("Sign-up error:", err)
      const code = err?.errors?.[0]?.code
      let msg = err?.errors?.[0]?.message ?? "Sign-up failed"
      if (code === 'form_identifier_not_allowed') msg = "Email already in use. Try logging in."
      else if (code === 'form_password_invalid') msg = "Password too weak. Use 8+ characters with mix."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    if (!isLoaded || !signUp) {
      setError("Auth system not ready")
      setLoading(false)
      return
    }

    try {
      const result = await signUp.attemptEmailAddressVerification({ code: verificationCode })
      console.log("Verification result:", result)
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        window.location.href = "/"
      } else {
        // Re-check for missing after verification
        if (result.missingFields?.length) {
          setMissingFields(result.missingFields)
          setStep('missing')
          setError(`After verification, still need: ${result.missingFields.join(', ')}`)
        } else {
          setError("Verification incomplete. Try resending code.")
        }
      }
    } catch (err: any) {
      console.error("Verification error:", err)
      setError(err?.errors?.[0]?.message ?? "Invalid code. Check email and try again.")
    } finally {
      setLoading(false)
    }
  }

  const resendCode = async (): Promise<void> => {
    if (!signUp) return
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      setError("Code resent. Check your email.")
    } catch (err: any) {
      setError("Failed to resend. Try again.")
    }
  }

  const renderForm = () => (
    <form onSubmit={handleSignUp} className="flex flex-col gap-2">
      <div className="flex flex-col md:flex-row gap-2">
        <input
          type="text"
          placeholder="First Name"
          className="px-3 py-1 w-[50%] text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px] flex-1"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Last Name"
          className="px-3 py-1 w-[50%] text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px] flex-1"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>
      {showUsername && (
        <input
          type="text"
          placeholder="Username"
          className="px-3 py-1 text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      )}
      <input
        type="email"
        placeholder="Email"
        className="px-3 py-1 text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {showPhone && (
        <input
          type="tel"
          placeholder="Phone Number"
          className="px-3 py-1 text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      )}
      <input
        type="password"
        placeholder="Password"
        className="px-3 py-1 text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <div className="text-red-500 text-xs text-center">{error}</div>}
      <button type="submit" disabled={loading} className="mt-2 bg-[#c15f3c] text-white py-1 rounded-md text-sm cursor-pointer disabled:opacity-50">
        {loading ? "Creating..." : "Sign up"}
      </button>
    </form>
  )

  const renderMissing = () => (
    <form onSubmit={(e) => { e.preventDefault(); updateMissingFields(); }} className="flex flex-col gap-2">
      {missingFields.includes('username') && !showUsername && (
        <input
          type="text"
          placeholder="Username (required)"
          className="px-3 py-1 text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      )}
      {missingFields.includes('phone_number') && !showPhone && (
        <input
          type="tel"
          placeholder="Phone Number (required)"
          className="px-3 py-1 text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      )}
      {error && <div className="text-red-500 text-xs text-center">{error}</div>}
      <button type="submit" disabled={loading} className="mt-2 bg-[#c15f3c] text-white py-1 rounded-md text-sm cursor-pointer disabled:opacity-50">
        {loading ? "Updating..." : "Continue"}
      </button>
    </form>
  )

  const renderVerify = () => (
    <form onSubmit={handleVerification} className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Enter 6-digit code from email"
        className="px-3 py-1 text-[13px] border border-[#e4e4e4a8] focus:border-[#c15f3c] rounded-md focus:outline-none text-[#939494] placeholder:text-[#939494] placeholder:text-[13px]"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
        required
        maxLength={6}
      />
      {error && <div className="text-red-500 text-xs text-center">{error}</div>}
      <button type="button" onClick={resendCode} className="text-xs text-[#c15f3c] text-center underline">
        Resend code
      </button>
      <button type="submit" disabled={loading} className="mt-2 bg-[#c15f3c] text-white py-1 rounded-md text-sm cursor-pointer disabled:opacity-50">
        {loading ? "Verifying..." : "Verify"}
      </button>
    </form>
  )

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#ffffff] overflow-x-hidden">
      {/* Sign Up Form */}
      <div className="w-full max-w-xs rounded-xl p-6 bg-transparent md:-translate-x-16 z-[9999]"> {/* md:mr-40 */}
        <h1 className="text-2xl font-light text-center text-black">
          {step === 'form' ? 'Create your account' : step === 'missing' ? 'Complete profile' : 'Verify email'}
        </h1>
        <h1 className="text-2xl font-light text-center mb-4 text-[#939494]">
          {step === 'form' ? 'Welcome to Falbor' : step === 'missing' ? 'Almost there' : 'Check your email'}
        </h1>

        <div id="clerk-captcha" className="mb-4"></div>

        {step === 'form' && renderForm()}
        {step === 'missing' && renderMissing()}
        {step === 'verify' && renderVerify()}

        {step === 'form' && (
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handleOAuthGoogle}
              className="flex items-center justify-center gap-2 rounded-md py-1 bg-[#e4e4e4a8] hover:bg-[#d6d6d6a8] text-[#3b3b3b] text-sm cursor-pointer"
              disabled={loadingProvider !== null || loading}
            >
              <img alt="Google" src="/googlelogo.png" className="w-4 h-4" />
              {loadingProvider === "google" ? "Opening..." : "Google"}
            </button>
            <button
              onClick={handleOAuthGithub}
              className="flex items-center justify-center gap-2 rounded-md py-1 bg-[#e4e4e4a8] hover:bg-[#d6d6d6a8] text-[#3b3b3b] text-sm cursor-pointer"
              disabled={loadingProvider !== null || loading}
            >
              <img alt="GitHub" src="/githublogo.png" className="w-4 h-4" />
              {loadingProvider === "github" ? "Opening..." : "GitHub"}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-[#939494] mt-4">
          {step === 'form' ? 'Already have an account?' : step === 'missing' ? 'Need help?' : 'Didn\'t receive code?'}{' '}
          <Link href={step === 'form' ? "/sign-in" : "/sign-in"} className="text-[#c15f3c]">{step === 'form' ? 'Log in' : step === 'missing' ? 'Contact support' : 'Resend'}</Link>
        </p>
        {step === 'form' && (
          <p className="text-center text-xs text-[#939494] mt-2">
            Protected by reCAPTCHA and Google Privacy Policy.
          </p>
        )}
      </div>

      {/* Globe on the right side - hidden on mobile */}
      {/* <div className="hidden md:block absolute inset-y-0 right-0 z-0 flex items-center pr-4">
        <div className="relative left-[120px] w-[600px] h-[600px] sm:w-[700px] sm:h-[700px] md:w-[800px] md:h-[800px] lg:w-[900px] lg:h-[900px]">
          <Globe className="absolute inset-0 w-full h-full opacity-80" />
        </div>
      </div> */}
    </div>
  )
}
// import { SignUp } from '@clerk/nextjs'

// export default function Page() {
//   return (
//       <div className='flex items-center justify-center h-screen'>
//         <SignUp />
//       </div>
//   )
// }