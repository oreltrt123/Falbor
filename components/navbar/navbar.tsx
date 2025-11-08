import Link from "next/link"
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

export async function Navbar() {
  const { userId } = await auth()

  return (
    <nav className="border-[#1b1b1b79] bg-[#1b1b1b79] border-b z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-sans font-light text-white">
          <img width={200} className="relative top-[-1px]" src="/logo-dark.png" alt="" />
        </Link>
        <div className="flex flex-1">
        {userId && (
          <Link href={'/projects'} className="text-white hover:text-[#f0f0f0]">
            Projects
          </Link>
        )}
        </div>
        <div className="flex items-center gap-4">
          {userId ? (
            <UserButton />
          ) : (
            <>
              <Link href={'/sign-in'}>
                <button className="text-sm font-medium hover:underline text-white">Sign In</button>
              </Link>
              <Link href={'/sign-up'}>
                <button className="text-sm font-medium hover:underline w-[70px] bg-[#0099FF] p-1 rounded-md text-white">
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
