// Modified: app/page.tsx (or wherever HomePage is defined)
import { auth } from "@clerk/nextjs/server"
import { Navbar } from "@/components/navbar/navbar"
import { InputArea } from "@/components/workbench/input-area" // New import
import { Globe } from "@/components/ui/globe"
import Footer from "@/components/layout/footer"
import HeroSection from "@/components/layout/HeroSection"
import Features from '@/components/layout/features'
import FAQ from '@/components/layout/faq'
// import { ProjectsList } from '@/components/projects-list'

export default async function HomePage() {
  const { userId } = await auth()

  return (
    <div className="relative min-h-screen flex flex-col bg-[#161616] overflow-hidden">
      {/* Foreground content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
            {/* <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[460px] h-[460px] sm:w-[460px] sm:h-[460px] md:w-[460px] md:h-[460px] lg:w-[750px] lg:h-[750px]">
                <Globe className="absolute inset-0 w-full h-full opacity-30 mix-blend-soft-light pointer-events-none" />
              </div>
            </div> */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 mt-[-130px] w-full">
          <div className="w-full flex flex-col items-center space-y-8 relative z-10">
            {/* Rotating globe background behind inputs */}

            {/* Main content area */}
            <div className="w-full flex flex-col items-center space-y-3 z-10">
              <div className="p-2 rounded-4xl">
                <h1 className="text-3xl font-sans font-light tracking-tight text-white text-center">
                  Create anything, anywhere automatically.
                </h1>
                <p className="text-white/85 font-sans text-[14px] font-light text-center w-full">
                  Build full projects with one prompt. Launch complete websites with one link.
                </p>
              </div>

              {/* Input Area (replaces separate ChatInput and GithubClone) */}
              <div className="w-full flex justify-center">
                <div className="w-[55%] sm:w-[45%] md:w-[35%] lg:w-[30%]">
                  <InputArea isAuthenticated={!!userId} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* <Features /> */}
      {/* Hero section (only for NOT logged in users) */}
      <div className="top-[-10px] relative">
        {!userId && <HeroSection />}
      </div>
      <div className="top-[-60px] relative">
       {!userId && <FAQ />}
      </div>
      {/* Footer stays at the bottom */}
      <Footer />
    </div>
  )
}