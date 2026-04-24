import { checkUser } from "@/lib/checkUser";
import { Button } from "./ui/button";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import RoleRedirect from "./RoleRedirect";
import CreditButton from "./CreditButton";
import { CalendarDays, Users } from "lucide-react";
import MobileMenu from "./MobileMenu"; // <-- Import your new component!

const Header = async () => {
  const user = await checkUser();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-3 sm:px-10 py-3 border-b border-white/7 backdrop-blur-xl bg-black/80">
      <Link href="/">
        <Image
          src="/image.png"
          alt="mokt Logo"
          width={100}
          height={100}
          className="h-11 w-auto"
        />
      </Link>

      {user && <RoleRedirect role={user.role} />}

      {/* 💻 DESKTOP VIEW (Hidden on Mobile) */}
      <div className="hidden md:flex items-center gap-3">
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="ghost">Sign in</Button>
          </SignInButton>
          <SignInButton mode="modal">
            <Button variant="gold">Get started →</Button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          {user?.role === "INTERVIEWER" && (
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}

          {user?.role === "INTERVIEWEE" && (
            <>
              <Button variant="ghost" asChild>
                <Link href="/explore">
                  <Users size={16} />
                  <span>Explore</span>
                </Link>
              </Button>
              <Button variant="default" asChild>
                <Link href="/appointments">
                  <CalendarDays size={16} />
                  <span>My Appointments</span>
                </Link>
              </Button>
            </>
          )}

          <CreditButton
            role={user?.role === "INTERVIEWER" ? "INTERVIEWER" : "INTERVIEWEE"}
            credits={
              (user?.role === "INTERVIEWER"
                ? user?.creditBalance
                : user?.credits) ?? 0
            }
          />

          <UserButton />
        </SignedIn>
      </div>

      {/* 📱 MOBILE VIEW (Hidden on Desktop) */}
      <div className="flex md:hidden items-center gap-3">
        <SignedIn>
          <UserButton /> {/* Keeps profile pic visible on mobile */}
        </SignedIn>
        <MobileMenu user={user} />
      </div>
    </nav>
  );
};

export default Header;