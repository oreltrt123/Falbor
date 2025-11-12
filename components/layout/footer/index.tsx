import Link from "next/link"
import React from "react"

function Footer() {
  return (
    // z-20 ensures the footer is above the globe; pointer-events-auto makes it clickable
    <div className="bg-none absolute bottom-0 w-full z-20 pointer-events-auto"> {/* border-t border-t-[#3b3b3fbe] */}
      <div className="p-3 font-sans font-light text-center flex items-center justify-center gap-3">
        {/* Privacy Link (don't wrap a button in Link) */}
        <Link
          href="/legal/privacy"
          className="ml-1 text-[14px] text-white/75 hover:text-white/95 transition-colors inline-flex items-center"
        >
          Privacy
        </Link>

        {/* Divider Image (Centered Between Links) */}
        <img
          width={20}
          height={20}
          src="/icons/line.png"
          alt="divider"
          className="mx-1 pointer-events-none opacity-60"
        />

        {/* Terms Link */}
        <Link
          href="/legal/terms"
          className="ml-1 text-[14px] text-white/75 hover:text-white/95 transition-colors inline-flex items-center"
        >
          Terms
        </Link>
        
        {/* Divider Image (Centered Between Links) */}
        <img
          width={20}
          height={20}
          src="/icons/line.png"
          alt="divider"
          className="mx-1 pointer-events-none opacity-60"
        />

        {/* Terms Link */}
        <Link
          href="https://discord.gg/FmPzZQm6"
          className="ml-1 text-[14px] text-white/75 hover:text-white/95 transition-colors inline-flex items-center"
        >
          Discord
        </Link>
        
        {/* Divider Image (Centered Between Links) */}
        <img
          width={20}
          height={20}
          src="/icons/line.png"
          alt="divider"
          className="mx-1 pointer-events-none opacity-60"
        />

        {/* Terms Link */}
        <Link
          href="https://www.reddit.com/r/Falbor/?feed=home"
          className="ml-1 text-[14px] text-white/75 hover:text-white/95 transition-colors inline-flex items-center"
        >
          Reddit
        </Link>
          {/* <Link href={'https://discord.gg/FmPzZQm6'} className="opacity-30 hover:opacity-25">
            <img className="absolute right-15 bottom-2.5" width={24} src="/icons/discord.png" alt="" />
          </Link>
          <Link href={'https://www.reddit.com/r/Falbor/?feed=home'} className="opacity-30 hover:opacity-25">
            <img className="absolute right-5 bottom-[9px]" width={32} src="/icons/reddit.png" alt="" />
          </Link> */}
      </div>
    </div>
  )
}

export default Footer
