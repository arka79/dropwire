"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Packet = { active: boolean; t: number; speed: number; size: number };

const MAX_PACKETS = 10;
const PACKET_SLOTS = Array.from({ length: MAX_PACKETS }, (_, index) => index);
const AUTO_SPAWN_MS = 2200;

function BrowserCard({
  label,
  caption,
  align,
}: {
  label: string;
  caption: string;
  align: "left" | "right";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="label flex items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden />
        {label}
      </span>
      <div className="w-full rounded-lg border border-line bg-surface p-2.5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-line-strong" aria-hidden />
          <span className="size-1.5 rounded-full bg-line-strong" aria-hidden />
          <span className="size-1.5 rounded-full bg-line-strong" aria-hidden />
          <span className="ml-1 h-1.5 flex-1 rounded-full bg-surface-2" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <div
            className={`h-1.5 rounded-full bg-surface-2 ${align === "right" ? "w-1/2 self-end" : "w-3/4"}`}
          />
          <div
            className={`h-1.5 rounded-full bg-surface-2 ${align === "right" ? "w-2/3 self-end" : "w-1/2"}`}
          />
          <div className="h-4 w-full rounded border border-dashed border-line" />
        </div>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {caption}
      </span>
    </div>
  );
}

/**
 * The hero schematic: two browsers wired directly together. Packets fly across
 * when you move over it or click it — the same route your files take.
 */
export function HeroVisual() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const nodeRefs = useRef<Array<SVGGElement | null>>([]);
  const packets = useRef<Packet[] | null>(null);
  const packetList = (): Packet[] => {
    if (!packets.current) {
      packets.current = Array.from({ length: MAX_PACKETS }, () => ({
        active: false,
        t: 0,
        speed: 0.5,
        size: 1,
      }));
    }
    return packets.current;
  };
  const frameRef = useRef<number | null>(null);
  const lastSpawn = useRef(0);
  const [orientation, setOrientation] = useState<"row" | "column">("row");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bursts, setBursts] = useState(0);
  const [visible, setVisible] = useState(true);

  const startLoop = useCallback(() => {
    if (frameRef.current !== null || reduced) return;
    let previous = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      let alive = false;
      packetList().forEach((packet, index) => {
        const node = nodeRefs.current[index];
        if (!node) return;
        if (packet.active) {
          packet.t += packet.speed * dt;
          if (packet.t >= 1.12) {
            packet.active = false;
          } else {
            alive = true;
          }
        }
        const t = Math.max(0, Math.min(1, packet.t));
        const fadeIn = Math.min(1, packet.t / 0.08);
        const fadeOut = Math.min(1, (1.12 - packet.t) / 0.14);
        const opacity = packet.active ? Math.max(0, Math.min(fadeIn, fadeOut)) : 0;
        node.style.opacity = String(opacity);
        if (orientation === "row") {
          node.style.transform = `translate(${t * size.width}px, ${size.height / 2}px) scale(${packet.size})`;
        } else {
          node.style.transform = `translate(${size.width / 2}px, ${t * size.height}px) scale(${packet.size})`;
        }
      });
      if (alive && visible) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(step);
  }, [orientation, reduced, size.height, size.width, visible]);

  const spawn = useCallback((count = 1, burst = false) => {
    if (reduced) return;
    let spawned = 0;
    for (const packet of packetList()) {
      if (spawned >= count) break;
      if (packet.active) continue;
      packet.active = true;
      packet.t = burst ? -spawned * 0.12 : 0;
      packet.speed = 0.45 + Math.random() * 0.35;
      packet.size = burst ? 1.15 : 1;
      spawned += 1;
    }
    startLoop();
  }, [reduced, startLoop]);


  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      const nextOrientation: "row" | "column" = rect.width >= 520 ? "row" : "column";
      setOrientation(nextOrientation);
      setSize({
        width: nextOrientation === "row" ? rect.width : rect.width,
        height: nextOrientation === "row" ? rect.height : rect.height,
      });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return;
    const interval = window.setInterval(() => {
      if (document.hidden || !visible) return;
      spawn(1);
    }, AUTO_SPAWN_MS);
    const onVisibility = () => {
      if (document.hidden && frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [reduced, spawn, visible]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const path =
    orientation === "row"
      ? `M 0 ${size.height / 2} L ${size.width} ${size.height / 2}`
      : `M ${size.width / 2} 0 L ${size.width / 2} ${size.height}`;

  const horizontal = orientation === "row";

  return (
    <figure className="relative">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="label">peer link · live</span>
        <span className="label flex items-center gap-1.5 text-live">
          <span className="size-1.5 rounded-full bg-live animate-pulse-dot" aria-hidden />
          direct
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative px-4 py-5 sm:px-6"
        onPointerMove={() => {
          const now = performance.now();
          if (now - lastSpawn.current < 220) return;
          lastSpawn.current = now;
          spawn(1);
        }}
        onPointerDown={() => {
          spawn(4, true);
          setBursts((value) => value + 1);
        }}
      >
        <div
          className={`flex items-stretch gap-3 sm:gap-4 ${
            horizontal ? "flex-row" : "flex-col"
          }`}
        >
          <div className={horizontal ? "w-[30%] max-w-[190px]" : "w-full"}>
            <BrowserCard label="you" caption="your browser" align="left" />
          </div>

          <div className="relative min-h-24 flex-1">
            <svg
              className="absolute inset-0 size-full overflow-visible"
              width="100%"
              height="100%"
              aria-hidden
            >
              <path
                ref={pathRef}
                d={path}
                fill="none"
                stroke="currentColor"
                className="text-line-strong"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
              <circle
                cx={horizontal ? 0 : size.width / 2}
                cy={horizontal ? size.height / 2 : 0}
                r="3"
                className="fill-brand"
              />
              <circle
                cx={horizontal ? size.width : size.width / 2}
                cy={horizontal ? size.height / 2 : size.height}
                r="3"
                className="fill-brand"
              />
              {PACKET_SLOTS.map((index) => (
                <g
                  key={index}
                  ref={(node) => {
                    nodeRefs.current[index] = node;
                  }}
                  style={{ opacity: 0 }}
                >
                  <rect x="-5" y="-3.5" width="10" height="7" rx="2" className="fill-brand" />
                </g>
              ))}
            </svg>

            <div
              className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
                horizontal ? "" : "hidden"
              }`}
            >
              <span className="rounded-full border border-line bg-canvas px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
                direct link
              </span>
            </div>
            <div
              className={`absolute inset-0 items-center justify-center pointer-events-none ${
                horizontal ? "hidden" : "flex"
              }`}
            >
              <span className="rounded-full border border-line bg-canvas px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
                direct link
              </span>
            </div>
          </div>

          <div className={horizontal ? "w-[30%] max-w-[190px]" : "w-full"}>
            <BrowserCard label="them" caption="their browser" align="right" />
          </div>
        </div>
      </div>

      <figcaption className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        <span className="text-[11px] text-ink-3">
          Hover or click the link — files take the same route.
        </span>
        <span className="font-mono text-[10px] text-ink-3" aria-live="polite">
          {bursts > 0 ? `${bursts} burst${bursts === 1 ? "" : "s"}` : "idle"}
        </span>
      </figcaption>
    </figure>
  );
}
