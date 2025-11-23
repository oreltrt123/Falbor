import { auth } from "@clerk/nextjs/server"
import { Navbar } from "@/components/navbar/navbar"
import Footer from "@/components/layout/footer"
import Image from "next/image"

export default async function HomePage() {
  const { userId } = await auth()

  return (
    <div className="relative min-h-screen flex flex-col bg-[#000000ef] overflow-hidden">
      <Navbar />

      {/* HERO IMAGE SECTION - Quarter screen height */}
      <section className="relative h-[57vh] w-full overflow-hidden">
      <section className="relative top-10 w-full py-16 px-4 flex items-center justify-center">
        <h1 className="text-[200px] font-light text-[#8999a3] text-center drop-shadow-lg">
          About Us
        </h1>
      </section>
      </section>
      {/* WHAT IS FALBOR? AND OUR MISSION - Two-column layout */}
      <section className="w-full py-20 px-4 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center justify-items-center">
        {/* What is Falbor? Column */}
        <div className="space-y-6 max-w-md">
          <h2 className="text-4xl font-light text-white/90">What is Falbor?</h2>
          <p className="text-white/90 leading-relaxed text-lg">
            Falbor is an AI-powered website builder that lets anyone turn ideas into working apps in minutes. Using just natural language, you can create personal tools, back-office apps, customer portals, or complete enterprise products that are ready to use.
          </p>
        </div>

        {/* Our Mission Column */}
        <div className="space-y-6 max-w-md">
          <h2 className="text-4xl font-light text-white/90">Our Mission</h2>
          <p className="text-white/90 leading-relaxed text-lg">
            At Falbor, our mission is to make it possible for anyone to turn their dream into a reality without needing to code, hire a team, or wait around. We've created a space where building something new is as simple as describing it.
          </p>
          <p className="text-white/90 leading-relaxed font-semibold text-sm uppercase tracking-wide">
            No complexity. No gatekeepers. Just you building.
          </p>
        </div>
      </section>

      {/* FOUNDING STORY - Light blue background with photo and text */}
      <section className="w-full py-20 px-4 bg-[#15171a]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Text */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-3xl font-light text-white/90">Founding Story</h2>
            <p className="text-white/90 leading-relaxed">
              Falbor started with a hunch. If you gave people the right starting point, and stripped away the friction of traditional software building, they'd create incredible things.
            </p>
          </div>

          {/* Founder Photo */}
          <div className="lg:col-span-1 flex justify-center">
            <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-lg">
              <Image
                src="/profile.png" // Replace with your photo path
                alt="Oral Revivo, Founder & CEO"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Right Text */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xl font-semibold text-white/90">Oral Revivo</h3>
            <p className="text-sm text-white/90">Founder & CEO</p>
            <p className="text-white/90 leading-relaxed">
              I’m Oral Revivo. I’m 16 years old, and I’ve been programming for six years.
              I built Falbor because when I started programming — long before AI tools existed —
              solving problems was extremely difficult. If you ran into a bug, you couldn’t send
              it to an AI to fix it. You had to dig through files, search outdated forums,
              and hope someone had the same issue.
              It slowed me down, made learning frustrating, and made it harder to stay focused on
              actually building things. Over time I realized something important: most people don’t
              struggle because they “can’t code” — they struggle because they get stuck.
              They get stuck on errors, stuck without ideas, stuck fixing problems instead of creating.
              So I wanted to build something I wish I had when I started — a tool focused on eliminating
              the pain, not just generating code.
            </p>
          </div>
        </div>
      </section>

      {/* TEAM SECTION - Single square since solo */}
      {/* <section className="w-full py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-light text-gray-900 text-center mb-12">Meet the Team</h2>
          <div className="grid grid-cols-1 gap-8 max-w-sm mx-auto">
            <div className="bg-gray-50 rounded-2xl p-8 text-center space-y-4 border border-gray-200">
              <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg">
                <Image
                  src="/profile.png" // Replace with your photo path
                  alt="Oral Revivo"
                  fill
                  className="object-cover"
                />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Oral Revivo</h3>
              <p className="text-gray-600">Programmer & Founder</p>
              <p className="text-gray-700 leading-relaxed text-sm">
                Hi, I’m 16 years old, and I’ve been programming for six years. I built Falbor because when I started — long before AI tools existed — solving problems was extremely difficult. Most people don’t struggle because they “can’t code” — they get stuck on errors, ideas, and fixing instead of creating. Falbor eliminates that pain, planning and building like a real developer.
              </p>
            </div>
          </div>
        </div>
      </section> */}

      {/* JOIN US SECTION - With Discord and Reddit buttons */}
      <section className="w-full py-20 px-4 bg-gradient-to-r from-[#000000ef] text-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-light">Join Us</h2>
          <p className="text-gray-300 leading-relaxed max-w-2xl mx-auto">
            The Falbor community is full of bold creators and builders who share knowledge, give feedback, and cheer each other on. Want to meet them?
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <a
              href="https://discord.gg/FmPzZQm6"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#5865f2e1] hover:bg-[#5865F2] text-white px-4 py-1 rounded-full font-light flex items-center space-x-3 transition-colors w-full sm:w-auto justify-center"
            >
              <span>Join us on Discord</span>
              <span className="text-sm">→</span>
            </a>
            <a
              href="https://www.reddit.com/r/Falbor/?feed=home"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#ff4400ce] hover:bg-[#FF4500] text-white px-4 py-1 rounded-full font-light flex items-center space-x-3 transition-colors w-full sm:w-auto justify-center"
            >
              <span>Connect on Reddit</span>
              <span className="text-sm">→</span>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}