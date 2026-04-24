"use client";

import { useState } from "react";
import { Menu, X, CalendarDays, Users } from "lucide-react";
import { Button } from "./ui/button";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import CreditButton from "./CreditButton";

export default function MobileMenu({ user }) {
  const [isOpen, setIsOpen] = useState(false);

  // This ensures the menu closes automatically when a user clicks a link
  const closeMenu = () => setIsOpen(false);

  return (
    <div className="md:hidden flex items-center gap-3">
      {/* Mobile Hamburger Toggle */}
      <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300 p-1">
        {isOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      {/* The Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-[68px] left-0 w-full bg-[#0a0a0a] border-b border-white/10 p-4 flex flex-col gap-4 shadow-2xl z-50">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" className="w-full justify-start" onClick={closeMenu}>Sign in</Button>
            </SignInButton>
            <SignInButton mode="modal">
              <Button variant="gold" className="w-full justify-start" onClick={closeMenu}>Get started →</Button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            {/* Show Credits in the menu */}
            <div className="mb-2">
              <CreditButton
                role={user?.role === "INTERVIEWER" ? "INTERVIEWER" : "INTERVIEWEE"}
                credits={(user?.role === "INTERVIEWER" ? user?.creditBalance : user?.credits) ?? 0}
              />
            </div>

            {user?.role === "INTERVIEWER" && (
              <Button variant="ghost" asChild className="w-full justify-start" onClick={closeMenu}>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            )}

            {user?.role === "INTERVIEWEE" && (
              <>
                <Button variant="ghost" asChild className="w-full justify-start" onClick={closeMenu}>
                  <Link href="/explore">
                    <Users size={18} className="mr-3" /> Explore Interviewers
                  </Link>
                </Button>
                <Button variant="default" asChild className="w-full justify-start" onClick={closeMenu}>
                  <Link href="/appointments">
                    <CalendarDays size={18} className="mr-3" /> My Appointments
                  </Link>
                </Button>
              </>
            )}
          </SignedIn>
        </div>
      )}
    </div>
  );
}