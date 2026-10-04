"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-40 border-b transition-colors duration-200",
        scrolled
          ? "border-line bg-canvas/85 backdrop-blur-md"
          : "border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Dropwire home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          <a
            href="#how"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            How it works
          </a>
          <a
            href="#privacy"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            Privacy
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden sm:inline-flex">
            <Button variant="secondary" size="sm" onClick={onJoin}>
              Join a room
            </Button>
          </span>
          <Button variant="primary" size="sm" onClick={onCreate} icon={<ArrowUpRight className="size-3.5" aria-hidden />}>
            Create room
          </Button>
        </div>
      </div>
    </header>
  );
}
