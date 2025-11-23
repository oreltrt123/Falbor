import { auth } from "@clerk/nextjs/server"
import { Navbar } from "@/components/navbar/navbar"
import { InputArea } from "@/components/workbench/input-area"
import { Globe } from "@/components/ui/globe"
import Footer from "@/components/layout/footer"
import HeroSection from "@/components/layout/HeroSection"
import Features from '@/components/layout/features'
import FAQ from '@/components/layout/faq'
import HeroText from "@/components/layout/hero"

export default async function HomePage() {
  const { userId } = await auth()
  return (
    <div className="relative min-h-screen flex flex-col bg-[#161616] overflow-hidden">
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main 
          className="flex flex-1 flex-col items-center justify-center px-4 w-full"
          style={{
           backgroundImage: `url("/bg/bg.png")`,
           backgroundRepeat: "no-repeat",
           backgroundSize: "cover",
           backgroundPosition: "center",
           }}>
          <div className="w-full flex flex-col items-center space-y-8 mt-[-140px] ml-5 relative z-10">
            <div className="w-full flex flex-col mt-[-140px] items-center space-y-3 z-10">
              <HeroText />
              <div className="w-full flex justify-center">
                <div className="w-full sm:w-[55%] md:w-[45%] lg:w-[35%] xl:w-[30%]">
                  <InputArea isAuthenticated={!!userId} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="top-[-10px] relative">
        {!userId && <HeroSection />}
      </div>
      <div className="top-[-60px] relative">
       {!userId && <FAQ />}
      </div>
      <Footer />
    </div>
  )
}