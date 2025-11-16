"use client"

import { useState, useEffect } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Badge } from "../ui/badge"

let stripePromise: Promise<any> | null = null

// Manual load to fix COEP
function getStripePromise() {
  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).Stripe) {
        resolve((window as any).Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''))
        return
      }

      const script = document.createElement('script')
      script.src = 'https://js.stripe.com/v3/'
      script.crossOrigin = 'anonymous'  // Key COEP fix
      script.async = true
      script.onload = () => {
        if (typeof window !== 'undefined') {
          const Stripe = (window as any).Stripe
          if (Stripe) {
            resolve(Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''))
          } else {
            reject(new Error('Stripe not loaded'))
          }
        }
      }
      script.onerror = () => reject(new Error('Failed to load Stripe.js'))
      document.head.appendChild(script)
    })
  }
  return stripePromise
}

interface PricingModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PricingModal({ open, onClose, onSuccess }: PricingModalProps) {
  const [clientSecret, setClientSecret] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    if (open && !clientSecret) {
      setError(null)
      setIsLoading(true)
      fetch("/api/subscribe", {
        method: "POST",
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((data) => { throw new Error(data.error || `API error: ${res.status}`) })
          }
          return res.json()
        })
        .then((data) => {
          if (data.client_secret) {
            setClientSecret(data.client_secret)
          } else {
            setError(data.error || "Failed to initialize payment")
          }
        })
        .catch((err) => {
          console.error("Subscribe fetch error:", err)
          setError(err.message || "Network error")
        })
        .finally(() => setIsLoading(false))
    }
  }, [open, clientSecret])

  if (!open) return null

  const options = clientSecret ? { clientSecret } : undefined

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-center">Upgrade to Premium <Badge className="bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black">Beta</Badge></h2>
        <p className="mb-6 text-center text-gray-600">
          $15/month - Get 40 credits every month
        </p>
        {isLoading ? (
          <div className="text-center py-4">Loading payment form...</div>
        ) : error ? (
          <div className="text-red-500 text-sm text-center mb-4">{error}</div>
        ) : clientSecret ? (
          <Elements stripe={getStripePromise()} options={options}>
            <CheckoutForm onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        ) : (
          <div className="text-center py-4">Unable to load payment. Please try again.</div>
        )}
        <button
          onClick={onClose}
          className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

interface CheckoutFormProps {
  onSuccess: () => void
  onClose: () => void
}

function CheckoutForm({ onSuccess, onClose }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      setError("Stripe.js has not loaded yet.")
      return
    }

    setIsLoading(true)
    setError(null)

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    })

    if (submitError) {
      setError(submitError.message || "Payment failed.")
    } else {
      onSuccess()
      onClose()
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <div className="text-red-500 text-sm text-center">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Processing..." : "Subscribe for $15/month"}
      </button>
    </form>
  )
}