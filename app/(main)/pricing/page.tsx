import { PricingTable } from '@clerk/nextjs'
import { Navbar } from "@/components/navbar/navbar"

export default function PricingPage() {
  return (
  <div className="min-h-screen bg-[#161616]">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
              {/* <PricingTable /> */}
              <span className='text-white'>There is no payment on the site yet.</span>
            </div>
          </div>
        </div>
      </main>
  </div>
  )
}