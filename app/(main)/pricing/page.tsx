"use client"

import { PayPalButtons } from "@paypal/react-paypal-js"
import { Verified, ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Navbar } from "@/components/navbar/navbar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

const tiers = [
  { name: "Standard", price: 10, credits: 20, plan: "Import from github", limits: "Unlimited projects" },
  { name: "Pro", price: 20, credits: 50, plan: "Import from github", limits: "Unlimited projects" },
  { name: "Elite", price: 60, credits: 200, plan: "Import from github", limits: "Unlimited projects" },
]

const CREDIT_RATE = 0.25

export default function Pricing() {
  const [subscriptionTier, setSubscriptionTier] = useState('none')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedCredits, setSelectedCredits] = useState(100)

  useEffect(() => {
    async function fetchTier() {
      const res = await fetch("/api/user/credits")
      if (res.ok) {
        const data = await res.json()
        setSubscriptionTier(data.subscriptionTier.toLowerCase())
      }
      setIsLoading(false)
    }
    fetchTier()
  }, [])

  const onApprove = async (data: any, actions: any, credits: number, tier?: string) => {
    const details = await actions.order.capture()
    const body: any = { orderId: details.id, credits }
    if (tier) body.tier = tier.toLowerCase()

    const res = await fetch("/api/user/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      alert("Payment successful! Credits added.")
      const refreshRes = await fetch("/api/user/credits")
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()
        setSubscriptionTier(refreshData.subscriptionTier.toLowerCase())
      }
    } else {
      alert("Payment succeeded but credit update failed.")
    }
  }

  const price = selectedCredits * CREDIT_RATE

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="bg-white h-screen">
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8 text-center text-black mt-35 ml-2 absolute">
          <span className="text-[#c15f3c]">Upgrade</span> Plans & Add credits
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-50">
          {tiers.map((tier) => {
            const isCurrentTier = subscriptionTier === tier.name.toLowerCase()
            return (
              <div
                key={tier.name}
                className="border border-[#e6e6e6] p-6 rounded-lg bg-[#e6e6e63d] text-black"
              >
                <h2 className="text-2xl font-semibold mb-2">{tier.name}</h2>
                <p className="text-xl mb-4">
                  ${tier.price} <span className="text-sm">/month</span>
                </p>
                <ul className="mb-6">
                  <li>
                    <span className="mr-[2px] inline-flex"><Verified className="text-white/80" /></span>
                    <span className="relative bottom-1.5 left-1">{tier.credits} of usage credit per month</span>
                  </li>
                  <li>
                    <span className="mr-[2px] inline-flex"><Verified className="text-white/80" /></span>
                    <span className="relative bottom-1.5 left-1">{tier.plan}</span>
                  </li>
                  <li>
                    <span className="mr-[2px] inline-flex"><Verified className="text-white/80" /></span>
                    <span className="relative bottom-1.5 left-1">{tier.limits}</span>
                  </li>
                </ul>

                {isCurrentTier ? (
                  <div className="text-center">
                    <p className="text-lg font-semibold mb-4">You are on this plan</p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="bg-[#e4e4e48c] text-black px-4 py-2 rounded w-full cursor-pointer"
                    >
                      Add More Credits
                    </button>
                  </div>
                ) : (
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        intent: "CAPTURE",
                        purchase_units: [
                          { amount: { value: tier.price.toString(), currency_code: "USD" } },
                        ],
                      })
                    }}
                    onApprove={(data, actions) => onApprove(data, actions, tier.credits, tier.name)}
                  />
                )}
              </div>
            )
          })}
        </div>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="z-[9999] max-w-sm overflow-y-auto bg-[#ffffff] border-0 p-0 sm:max-w-md">
            <DialogHeader className="p-6 pb-6 mb-[-30px]">
              <DialogTitle className="text-black text-xl">Select Credits to Add</DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-4">
              {/* Dropdown Menu for Credits */}
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full bg-white border-2 border-[#c15f3c] rounded-md px-3 py-2 text-left flex justify-between items-center">
                  {selectedCredits} credits - ${price.toFixed(2)}
                  <ChevronDown className="ml-2" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                 className="w-full z-[99999] shadow-lg" 
                 side="bottom"
                 align="start"
                 >
                  {[100,200,300,400,500,600,700,800,900,1000].map((amt) => (
                    <DropdownMenuItem
                      key={amt}
                      onSelect={() => setSelectedCredits(amt)}
                    >
                      {amt} credits - ${ (amt * CREDIT_RATE).toFixed(2) }
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <PayPalButtons
                style={{ layout: "vertical" }}
                createOrder={(data, actions) => {
                  return actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [{ amount: { value: price.toString(), currency_code: "USD" } }],
                  })
                }}
                onApprove={(data, actions) =>
                  onApprove(data, actions, selectedCredits).then(() => setShowModal(false))
                }
              />
            </div>

            <DialogFooter className="px-3 pb-3 flex gap-2">
              <Button
                onClick={() => setShowModal(false)}
                variant="secondary"
                className="flex-1 bg-[#e4e4e4b4] hover:bg-[#e4e4e4b4] text-black"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}