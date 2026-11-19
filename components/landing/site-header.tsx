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
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200",
        scrolled
          ? "border-line bg-canvas/95 backdrop-blur-md"
          : "border-transparent bg-canvas/80 backdrop-blur-sm",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Link href="/" className="rounded-[3px]" aria-label="Dropwire home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          <a
            href="#how"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Protocol
          </a>
          <a
            href="#privacy"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Privacy
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm" onClick={onJoin}>
              Join a room
            </Button>
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={onCreate}
            icon={<ArrowUpRight className="size-3.5" aria-hidden />}
          >
            Create room
          </Button>
        </div>
      </div>
    </header>
  );
}
