"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { PayPalScriptProvider } from "@paypal/react-paypal-js"

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID

  // Safety check - this will throw a clear error during build/runtime if the env var is missing
  if (!paypalClientId) {
    throw new Error(
      "Please define NEXT_PUBLIC_PAYPAL_CLIENT_ID in your .env.local file"
    )
  }

  return (
    <ClerkProvider>
      <PayPalScriptProvider options={{ clientId: paypalClientId }}>
        {children}
      </PayPalScriptProvider>
    </ClerkProvider>
  )
}