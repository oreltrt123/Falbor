import Link from "next/link"
import React from "react"

function Footer() {
  return (
    // z-20 ensures the footer is above the globe; pointer-events-auto makes it clickable
    <div className="bg-[#181818] border-t border-t-[#3b3b3fbe] absolute bottom-0 w-full z-20 pointer-events-auto">
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
          className="mx-1 pointer-events-none"
        />

        {/* Terms Link */}
        <Link
          href="/legal/terms"
          className="ml-1 text-[14px] text-white/75 hover:text-white/95 transition-colors inline-flex items-center"
        >
          Terms
        </Link>
      </div>
    </div>
  )
}

export default Footer
