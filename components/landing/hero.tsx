"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Boxes, FileX2, KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroVisual } from "./hero-visual";

const INDICATORS = [
  { icon: Boxes, label: "Browser-to-browser" },
  { icon: FileX2, label: "No file storage" },
  { icon: Lock, label: "Encrypted in transit" },
] as const;

export function Hero({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      <div className="grid-field pointer-events-none absolute inset-0 [mask-image:radial-gradient(120%_80%_at_50%_0%,black,transparent_75%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line-strong/60 to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pb-24 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div>
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="label flex flex-wrap items-center gap-x-3 gap-y-2"
            >
              <span className="flex items-center gap-1.5 text-live">
                <span className="size-1.5 rounded-full bg-live animate-pulse-dot" aria-hidden />
                peer link ready
              </span>
              <span className="text-ink-3">no account · no app · no upload</span>
            </motion.p>

            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="mt-5 text-[clamp(2.5rem,8vw,4.25rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-ink"
            >
              Move files.
              <br />
              <span className="text-ink-3">
                Not through us<span className="text-brand">.</span>
              </span>
            </motion.h1>

            <motion.p
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2 sm:text-base"
            >
              Private, browser-to-browser file sharing. No uploads. No accounts.
              No permanent storage.
            </motion.p>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button variant="primary" size="lg" onClick={onCreate}>
                Create a room
              </Button>
              <Button variant="secondary" size="lg" onClick={onJoin}>
                Join a room
              </Button>
            </motion.div>

            <motion.ul
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5"
            >
              {INDICATORS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3"
                >
                  <Icon className="size-3.5 text-ink-3" aria-hidden />
                  {label}
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="panel overflow-hidden">
              <HeroVisual />
            </div>
            <div className="pointer-events-none absolute -bottom-3 left-4 hidden items-center gap-2 rounded-full border border-line bg-canvas px-3 py-1 sm:flex">
              <KeyRound className="size-3 text-brand" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                server sees: handshake only
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
