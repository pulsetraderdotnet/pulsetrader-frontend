// navbar.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FiActivity } from "react-icons/fi";
import NavbarRight from "./navbarRightPanel";

export default function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleScroll = () => setIsScrolled(window.scrollY > 20);
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <header className="sticky top-0 w-full z-50">
      <nav
        className={`w-full transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/[0.06] shadow-sm dark:shadow-[0_1px_20px_rgba(0,0,0,0.5)]"
            : "bg-white/50 dark:bg-transparent backdrop-blur-sm border-b border-transparent"
        }`}
      >
        <div className="w-full mx-auto px-4 py-3">
          <div className="w-full flex justify-between items-center">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-violet-600 rounded-full opacity-0 group-hover:opacity-20 blur transition-opacity duration-300" />
                <FiActivity
                  className="w-7 h-7 text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors"
                  strokeWidth={2.5}
                />
              </div>
              <span className="hidden sm:block text-xl font-black tracking-tighter text-gray-900 dark:text-white">
                PULSE<span className="text-blue-500">TRADER</span>
              </span>
            </Link>

            <NavbarRight pathname={pathname} />
          </div>
        </div>
      </nav>
    </header>
  );
}