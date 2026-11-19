"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroVisual } from "./hero-visual";

const FACTS: Array<[string, string]> = [
  ["Transport", "webrtc datachannel"],
  ["Server", "handshake only"],
  ["Lifetime", "6 hours"],
];

export function Hero({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  const reduced = useReducedMotion();

  return (
    <section className="relative border-b border-line">
      <div className="mx-auto grid w-full max-w-[1400px] lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.02fr_0.98fr]">
        <div className="flex flex-col justify-center px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:px-12 lg:py-20">
          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2"
          >
            <span className="size-2 bg-brand" aria-hidden />
            browser to browser
          </motion.div>

          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.04, ease: [0.23, 1, 0.32, 1] }}
            className="display mt-7 text-[clamp(2.9rem,7.2vw,5.6rem)] text-ink"
          >
            Move files.
            <br />
            Not through us.
          </motion.h1>

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease: [0.23, 1, 0.32, 1] }}
            className="mt-7 max-w-[34rem] text-[16px] leading-relaxed text-ink-2"
          >
            A room is the only thing this server knows. Open one, share the code,
            and the file crosses directly between the two browsers.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={onCreate}
              icon={<ArrowUpRight className="size-4" aria-hidden />}
            >
              Create a room
            </Button>
            <Button variant="secondary" size="lg" onClick={onJoin}>
              Join with a code
            </Button>
          </motion.div>

          <motion.dl
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-12 grid max-w-[34rem] grid-cols-1 border-t border-line sm:grid-cols-3"
          >
            {FACTS.map(([term, value], index) => (
              <div
                key={term}
                className={[
                  "py-3 sm:py-4",
                  index > 0 ? "border-t border-line sm:border-l sm:border-t-0 sm:pl-4" : "",
                ].join(" ")}
              >
                <dt className="label">{term}</dt>
                <dd className="mt-1.5 font-mono text-[11px] text-ink-2">{value}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="border-t border-line lg:border-l lg:border-t-0"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
