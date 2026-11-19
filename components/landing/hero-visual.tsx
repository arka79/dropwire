"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

type Packet = { active: boolean; t: number; speed: number };

const MAX_PACKETS = 9;
const PACKET_SLOTS = Array.from({ length: MAX_PACKETS }, (_, index) => index);
const AUTO_SPAWN_MS = 2400;
const BASE_TILT_X = 8;

function Terminal({
  label,
  note,
  reversed = false,
  tilt,
}: {
  label: string;
  note: string;
  reversed?: boolean;
  tilt?: string;
}) {
  return (
    <div className="w-full" style={{ transformStyle: "preserve-3d" }}>
      <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="text-chassis-ink/70">{label}</span>
        <span className="text-chassis-ink/35">{note}</span>
      </div>

      <div
        style={{ transform: tilt }}
        className={[
          "mt-2 border border-white/30 bg-white/[0.05]",
          "shadow-[0_26px_50px_-22px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.12)]",
        ].join(" ")}
      >
        <div className="flex items-center gap-1.5 border-b border-white/15 bg-white/[0.04] px-2 py-1.5">
          <span className="size-1.5 bg-white/25" aria-hidden />
          <span className="size-1.5 bg-white/25" aria-hidden />
          <span className="size-1.5 bg-white/25" aria-hidden />
          <span className="ml-auto h-1.5 w-8 bg-white/10" aria-hidden />
        </div>
        <div className="space-y-1.5 p-2.5">
          <div className="h-1.5 w-2/3 bg-white/15" aria-hidden />
          <div className="h-1.5 w-1/3 bg-white/10" aria-hidden />
          <div
            className={[
              "mt-2 flex items-center gap-2 border border-dashed border-white/30 px-1.5 py-1.5",
              reversed ? "flex-row-reverse" : "",
            ].join(" ")}
          >
            <span className="size-3 shrink-0 border border-white/40 bg-lamp/25" aria-hidden />
            <span className="h-1 w-8 bg-white/25" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The console in the hero's other half: two terminals on a floor plane with
 * the wire between them. It reads as a small physical diorama — the scene
 * tilts toward the pointer and the bytes keep moving regardless.
 */
export function HeroVisual() {
  const reduced = useReducedMotion();
  const figureRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const wireRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Array<SVGGElement | null>>([]);
  const packets = useRef<Packet[] | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastSpawn = useRef(0);
  const [orientation, setOrientation] = useState<"row" | "column">("row");
  const [size, setSize] = useState({ width: 0, height: 0 });

  const rotateX = useSpring(BASE_TILT_X, { stiffness: 90, damping: 18, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 90, damping: 18, mass: 0.6 });

  // The console lays back as the page scrolls past: the camera leaves it behind.
  const { scrollYProgress } = useScroll({
    target: figureRef,
    offset: ["start start", "end start"],
  });
  const sceneRotateX = useTransform(scrollYProgress, [0, 1], [0, 15]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, -28]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  const packetList = (): Packet[] => {
    if (!packets.current) {
      packets.current = Array.from({ length: MAX_PACKETS }, () => ({
        active: false,
        t: 0,
        speed: 0.5,
      }));
    }
    return packets.current;
  };

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
          if (packet.t >= 1.12) packet.active = false;
          else alive = true;
        }
        const t = Math.max(0, Math.min(1, packet.t));
        const fadeIn = Math.min(1, packet.t / 0.08);
        const fadeOut = Math.min(1, (1.12 - packet.t) / 0.14);
        node.style.opacity = packet.active
          ? String(Math.max(0, Math.min(fadeIn, fadeOut)))
          : "0";
        if (orientation === "row") {
          node.style.transform = `translate(${t * size.width}px, ${size.height / 2}px)`;
        } else {
          node.style.transform = `translate(${size.width / 2}px, ${t * size.height}px)`;
        }
      });
      frameRef.current = alive ? requestAnimationFrame(step) : null;
    };
    frameRef.current = requestAnimationFrame(step);
  }, [orientation, reduced, size.height, size.width]);

  const spawn = useCallback(
    (count = 1, burst = false, from?: number) => {
      if (reduced) return;
      let spawned = 0;
      for (const packet of packetList()) {
        if (spawned >= count) break;
        if (packet.active) continue;
        packet.active = true;
        packet.t =
          from !== undefined
            ? from + spawned * 0.05
            : burst
              ? -spawned * 0.1
              : 0;
        packet.speed = 0.42 + Math.random() * 0.32;
        spawned += 1;
      }
      startLoop();
    },
    [reduced, startLoop],
  );

  useEffect(() => {
    const row = rowRef.current;
    const wire = wireRef.current;
    if (!row || !wire) return;

    const measureRow = () => {
      const rect = row.getBoundingClientRect();
      setOrientation(rect.width >= 420 ? "row" : "column");
    };
    const measureWire = () => {
      const rect = wire.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measureRow();
    measureWire();

    const rowObserver = new ResizeObserver(measureRow);
    rowObserver.observe(row);
    const wireObserver = new ResizeObserver(measureWire);
    wireObserver.observe(wire);

    return () => {
      rowObserver.disconnect();
      wireObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) spawn(1);
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
  }, [reduced, spawn]);

  const horizontal = orientation === "row";

  const handlePointer = (event: React.PointerEvent) => {
    if (reduced || event.pointerType !== "mouse") return;
    const element = sceneRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(BASE_TILT_X - py * 6);
    rotateY.set(px * 12);

    const now = performance.now();
    if (now - lastSpawn.current < 260) return;
    lastSpawn.current = now;
    spawn(1);
  };

  const resetTilt = () => {
    rotateX.set(BASE_TILT_X);
    rotateY.set(0);
  };

  /** Tap anywhere on the wire and the bytes leave from under your finger. */
  const handleWire = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const along = horizontal
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    spawn(3, false, Math.min(0.9, Math.max(0.02, along)));
  };

  return (
    <figure
      ref={figureRef}
      className="flex h-full flex-col bg-chassis text-chassis-ink"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/15 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="text-chassis-ink/50">link console</span>
        <span className="flex items-center gap-2 text-lamp">
          <span className="size-1.5 bg-lamp animate-blink" aria-hidden />
          live
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center overflow-hidden px-5 py-7 sm:px-7 sm:py-9">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-chassis-ink/40">
          room
        </p>
        <p className="mt-1 flex items-center font-mono text-[clamp(1.4rem,3.4vw,1.9rem)] tracking-[0.14em] text-lamp">
          NOVA-7K2P
          <span
            aria-hidden
            className="ml-2 inline-block h-[0.82em] w-[0.44em] bg-lamp/70 animate-blink"
          />
        </p>

        {/* The diorama: perspective on the frame, 3D on the scene. */}
        <div className="mt-6 [perspective:1200px]">
          <motion.div
            style={
              reduced
                ? undefined
                : {
                    rotateX: sceneRotateX,
                    y: sceneY,
                    scale: sceneScale,
                    transformStyle: "preserve-3d",
                  }
            }
          >
          <motion.div
            ref={sceneRef}
            onPointerMove={handlePointer}
            onPointerLeave={resetTilt}
            style={
              reduced
                ? { transformStyle: "preserve-3d" }
                : { rotateX, rotateY, transformStyle: "preserve-3d" }
            }
            className="relative mt-1 py-6 [transform-style:preserve-3d]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-[85%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(255,212,0,0.2),transparent)] [transform:translateZ(-80px)]"
            />

            <div
              ref={rowRef}
              className={[
                "relative flex gap-3 sm:gap-4",
                horizontal ? "flex-row items-center" : "flex-col",
              ].join(" ")}
            >
              <div
                className={horizontal ? "w-[32%] max-w-[170px] shrink-0" : "w-full"}
                style={{ transformStyle: "preserve-3d" }}
              >
                <Terminal
                  label="this browser"
                  note="you"
                  tilt={horizontal ? "translateZ(24px) rotateY(12deg)" : undefined}
                />
              </div>

              <div
                ref={wireRef}
                onPointerDown={handleWire}
                className={[
                  "relative min-h-[88px] min-w-0 flex-1 cursor-pointer",
                  horizontal ? "h-14" : "h-20",
                ].join(" ")}
              >
                <svg
                  className="absolute inset-0 size-full overflow-visible"
                  width="100%"
                  height="100%"
                  aria-hidden
                >
                  <path
                    d={
                      horizontal
                        ? `M 0 ${size.height / 2} L ${size.width} ${size.height / 2}`
                        : `M ${size.width / 2} 0 L ${size.width / 2} ${size.height}`
                    }
                    fill="none"
                    stroke="currentColor"
                    className="text-lamp/45"
                    strokeWidth="1.25"
                    strokeDasharray="2 6"
                    strokeLinecap="round"
                  />
                  <rect
                    x={horizontal ? 0 : size.width / 2 - 3}
                    y={horizontal ? size.height / 2 - 3 : 0}
                    width="6"
                    height="6"
                    className="fill-lamp"
                  />
                  <rect
                    x={horizontal ? size.width - 6 : size.width / 2 - 3}
                    y={horizontal ? size.height / 2 - 3 : size.height - 6}
                    width="6"
                    height="6"
                    className="fill-lamp"
                  />
                  {PACKET_SLOTS.map((index) => (
                    <g
                      key={index}
                      ref={(node) => {
                        nodeRefs.current[index] = node;
                      }}
                      style={{
                        opacity: 0,
                        filter: "drop-shadow(0 0 6px rgba(255, 212, 0, 0.75))",
                      }}
                    >
                      {/* Isometric packet cube: three lit faces. */}
                      <polygon
                        points="0,-5 5,-2.5 0,0 -5,-2.5"
                        className="fill-lamp"
                      />
                      <polygon
                        points="-5,-2.5 0,0 0,5 -5,2.5"
                        className="fill-lamp"
                        opacity="0.55"
                      />
                      <polygon
                        points="5,-2.5 0,0 0,5 5,2.5"
                        className="fill-lamp"
                        opacity="0.3"
                      />
                    </g>
                  ))}
                </svg>

                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/25 bg-chassis px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-chassis-ink/60">
                  direct
                </span>
              </div>

              <div
                className={horizontal ? "w-[32%] max-w-[170px] shrink-0" : "w-full"}
                style={{ transformStyle: "preserve-3d" }}
              >
                <Terminal
                  label="their browser"
                  note="them"
                  reversed
                  tilt={horizontal ? "translateZ(24px) rotateY(-12deg)" : undefined}
                />
              </div>
            </div>

            {/* Floor plane: what makes the slabs sit on something. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-[-58%] h-[74%] opacity-40 [transform:rotateX(74deg)] [transform-origin:center_bottom]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, rgba(247,246,238,0.22) 0 1px, transparent 1px 44px), repeating-linear-gradient(to bottom, rgba(247,246,238,0.22) 0 1px, transparent 1px 44px)",
                maskImage: "linear-gradient(to top, black, transparent)",
                WebkitMaskImage: "linear-gradient(to top, black, transparent)",
              }}
            />
          </motion.div>
          </motion.div>
        </div>

        <div className="mt-6">
          <div className="ruler text-chassis-ink" aria-hidden />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[10px] text-chassis-ink/45">
            <span>tap the wire · 64 KB frames, acked on arrival</span>
            <button
              type="button"
              onClick={() => spawn(4, true)}
              className="text-lamp underline decoration-dotted underline-offset-4 transition-colors hover:text-chassis-ink focus-visible:text-chassis-ink"
            >
              Send a burst
            </button>
          </div>
        </div>
      </div>
    </figure>
  );
}
