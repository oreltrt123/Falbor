import { auth } from "@clerk/nextjs/server"
import { Navbar } from "@/components/navbar/navbar"
import { ChatInput } from "@/components/workbench/chat-input"
import { GithubClone } from "@/components/github-clone"
import { Globe } from "@/components/ui/globe"
import Footer from "@/components/layout/footer"
import HeroSection from "@/components/layout/HeroSection"

export default async function HomePage() {
  const { userId } = await auth()

  return (
    <div className="relative min-h-screen flex flex-col bg-[#161616] overflow-hidden">
      {/* Foreground content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex flex-1 flex-col items-center justify-center px-4 mt-[-130px] w-full">
          <div className="w-full flex flex-col items-center space-y-8 relative z-10">
            {/* Rotating globe background behind inputs */}

            {/* Main content area */}
            <div className="w-full flex flex-col items-center space-y-8 z-10">
              <div className="p-2 rounded-4xl">
                <h1 className="text-4xl font-sans font-light tracking-tight text-white text-center">
                  Create anything, anywhere automatically.
                </h1>
                <p className="text-white/85 font-sans font-light text-center w-full">
                  Build full projects with one prompt. Launch complete websites with one link.
                </p>
              </div>

              {/* Chat Input */}
              <div className="w-full flex justify-center">
                <div className="w-[70%] sm:w-[60%] md:w-[50%] lg:w-[45%]">
                  <ChatInput isAuthenticated={!!userId} />
                </div>
              </div>

              {/* GitHub Clone Input (only for authenticated users) */}
              {userId && (
                <div className="w-full flex justify-center">
                  <div className="w-[70%] sm:w-[60%] md:w-[50%] lg:w-[45%]">
                    <GithubClone />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      {/* Hero section (only for NOT logged in users) */}
      <div className="top-[-10px] relative">
        {!userId && <HeroSection />}
      </div>
      {/* Footer stays at the bottom */}
      <Footer />
    </div>
  )
}
