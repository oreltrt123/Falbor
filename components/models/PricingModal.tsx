"use client"

import { useState, useEffect, useRef } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Badge } from "../ui/badge"

let stripePromise: Promise<any> | null = null

// Manual load with COEP fix (crossOrigin='anonymous')
function getStripePromise() {
  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).Stripe) {
        console.log('Stripe already loaded')
        resolve((window as any).Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''))
        return
      }

      console.log('Loading Stripe script with COEP fix...')
      const script = document.createElement('script')
      script.src = 'https://js.stripe.com/v3/'
      script.crossOrigin = 'anonymous'  // Fixes COEP block
      script.async = true
      script.onload = () => {
        if (typeof window !== 'undefined') {
          const Stripe = (window as any).Stripe
          if (Stripe) {
            console.log('Stripe loaded successfully')
            resolve(Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''))
          } else {
            reject(new Error('Stripe not found'))
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
  const [intentType, setIntentType] = useState<'payment' | 'setup'>('payment')
  const [isTrial, setIsTrial] = useState(false)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!open) {
      setClientSecret("")
      setIntentType('payment')
      setIsTrial(false)
      setInvoiceId(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (open && !clientSecret) {
      setError(null)
      setIsLoading(true)
      console.log('Fetching /api/subscribe...')
      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then((res) => {
          if (!res.ok) return res.json().then((data) => { throw new Error(data.error || `API error: ${res.status}`) })
          return res.json()
        })
        .then((data) => {
          console.log("API Response:", data)
          if (data.client_secret) {
            console.log('Setting clientSecret: Yes (pi_...)')
            setClientSecret(data.client_secret)
            setIntentType(data.intentType || 'payment')
            setIsTrial(data.isTrial || false)
            setInvoiceId(data.invoiceId || null)
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

  // FIXED: Use 'as const' on theme to match literal type '"stripe"'
  const options = clientSecret ? { 
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: { colorPrimary: '#0570de', colorText: '#30313d' },
    },
  } : undefined

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-center">
          Upgrade to Premium <Badge className="bg-[#e4e4e4] hover:bg-[#e7e7e7] text-black">Beta</Badge>
        </h2>
        <p className="mb-6 text-center text-gray-600">
          $15/month - Get 40 credits every month
          {isTrial && <span className="block text-sm text-blue-600 mt-1">Secure your card for future payments (free trial starts now)</span>}
        </p>
        {isLoading ? (
          <div className="text-center py-4">Loading payment form...</div>
        ) : error ? (
          <div className="text-red-500 text-sm text-center mb-4">{error}</div>
        ) : clientSecret ? (
          <Elements stripe={getStripePromise()} options={options}>
            <CheckoutForm 
              intentType={intentType} 
              isTrial={isTrial}
              invoiceId={invoiceId}
              onSuccess={onSuccess} 
              onClose={onClose} 
            />
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
  intentType: 'payment' | 'setup'
  isTrial: boolean
  invoiceId: string | null
  onSuccess: () => void
  onClose: () => void
}

function CheckoutForm({ intentType, isTrial, invoiceId, onSuccess, onClose }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaymentReady, setIsPaymentReady] = useState(false)
  const paymentElementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (stripe && elements) {
      console.log('Stripe and Elements ready in CheckoutForm')
      // FIXED: Use type assertion for untyped 'version' property
      console.log('Stripe version:', (stripe as any)?.version || 'N/A')
      console.log('Intent type:', intentType)
    } else {
      console.log('Waiting for Stripe/Elements to load...')
    }
  }, [stripe, elements, intentType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !isPaymentReady) {
      setError("Payment form not ready. Please wait a moment and try again.")
      console.error('Stripe, Elements, or PaymentElement not ready on submit')
      return
    }

    setIsLoading(true)
    setError(null)

    let confirmResult
    try {
      if (intentType === 'setup') {
        confirmResult = await stripe.confirmSetup({
          elements,
          confirmParams: {},
          redirect: "if_required",
        })
      } else {
        confirmResult = await stripe.confirmPayment({
          elements,
          confirmParams: {},
          redirect: "if_required",
        })
      }

      if (confirmResult.error) {
        setError(confirmResult.error.message || "Payment failed.")
        console.error('Stripe confirm error:', confirmResult.error)
      } else {
        console.log('Stripe confirm success!')
        fetch("/api/subscribe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intentType, invoiceId }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (!data.success) console.error("Confirm API failed:", data.error)
            else console.log('DB confirmed successfully')
          })
          .catch(console.error)

        onSuccess()
        onClose()
      }
    } catch (err: any) {
      console.error('Confirm exception:', err)
      setError(err.message || "Unexpected error")
    }

    setIsLoading(false)
  }

  const buttonText = isTrial 
    ? "Secure Card & Start Trial" 
    : isLoading 
      ? "Processing..." 
      : "Subscribe for $15/month"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div 
        ref={paymentElementRef}
        className="p-4 border border-gray-300 rounded-md bg-white min-h-[150px] flex flex-col items-start justify-start"
        style={{ position: 'relative' }}
      >
        <PaymentElement 
          options={{
            layout: 'tabs',
            fields: { 
              billingDetails: { 
                name: "auto",
                address: {
                  postalCode: "auto"
                }
              } 
            }, // FIXED: Nested postalCode under address; removed invalid 'billingZip'
            // style: {
            //   base: {
            //     fontSize: '16px',
            //     color: '#424770',
            //     '::placeholder': { color: '#aab7c4' },
            //   },
            // },
          }}
          onReady={(element) => {
            console.log('PaymentElement ready and mounted!')
            setIsPaymentReady(true)
            if (paymentElementRef.current) {
              console.log('Payment container dimensions:', paymentElementRef.current.getBoundingClientRect())
            }
          }}
          onChange={(event) => {
            console.log('PaymentElement change:', event.complete ? 'Valid' : 'Incomplete')
          }}
        />
        {!isPaymentReady && <p className="text-sm text-gray-500 mt-2">Loading secure form...</p>}
      </div>
      {error && <div className="text-red-500 text-sm text-center">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || !elements || !isPaymentReady || isLoading}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {buttonText}
      </button>
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 text-center">
          Debug: Stripe ready: {stripe ? 'Yes' : 'No'} | Elements ready: {elements ? 'Yes' : 'No'} | Form ready: {isPaymentReady ? 'Yes' : 'No'}
        </div>
      )}
    </form>
  )
}