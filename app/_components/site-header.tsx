"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "./brand";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Safety" },
  { href: "#companions", label: "Companions" },
  { href: "#occasions", label: "Occasions" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`po-topbar${scrolled ? " is-scrolled" : ""}`}>
      <div className="po-topbar-inner">
        <Brand size={30} />
        <nav className="po-topbar-nav" aria-label="Sections">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="po-topbar-actions">
          {signedIn ? (
            <Link href="/bookings" className="po-topbar-signin">
              My bookings
            </Link>
          ) : (
            <Link href="/login" className="po-topbar-signin">
              Sign in
            </Link>
          )}
          <a href="#waitlist" className="po-btn po-btn-sm">
            Join the waitlist
          </a>
        </div>
      </div>
    </header>
  );
}
