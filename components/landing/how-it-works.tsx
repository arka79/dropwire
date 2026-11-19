import { ScanLine, SquareArrowOutUpRight } from "lucide-react";
import { IsoBlock } from "./iso-block";
import { ScrollPiece } from "./scroll-piece";

const STEPS = [
  {
    number: "01",
    title: "Open a room",
    body: "The server mints a code and keeps the door list. Nothing else about the transfer exists on our side.",
    art: (
      <div className="flex items-center gap-3">
        <ScrollPiece className="h-20 w-28 shrink-0">
          <IsoBlock pattern="code" className="size-full" />
        </ScrollPiece>
        <span className="inline-flex items-center gap-2 border border-white/25 px-2 py-1 font-mono text-[12px] tracking-[0.16em] text-lamp">
          NOVA-7K2P
          <SquareArrowOutUpRight className="size-3 text-chassis-ink/50" aria-hidden />
        </span>
      </div>
    ),
  },
  {
    number: "02",
    title: "Hand over the code",
    body: "The other device joins with the link, the code, or a scanned QR. No install, no account, no permission dialog to fight.",
    art: (
      <div className="flex items-center gap-3">
        <ScrollPiece className="h-20 w-28 shrink-0" rotateYFrom={-26} yFrom={12}>
          <IsoBlock pattern="qr" className="size-full" />
        </ScrollPiece>
        <span className="font-mono text-[11px] text-chassis-ink/55">scan to join</span>
      </div>
    ),
  },
  {
    number: "03",
    title: "Send the bytes",
    body: "The handshake completes and the two browsers open a data channel. Frames cross directly; the server watches nothing.",
    art: (
      <div className="flex items-center gap-3">
        <ScrollPiece className="h-20 w-28 shrink-0" rotateYFrom={-48} yFrom={22}>
          <IsoBlock packet className="size-full" />
        </ScrollPiece>
        <span className="font-mono text-[11px] text-chassis-ink/55">direct connection</span>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-chassis text-chassis-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72 opacity-25 [perspective:520px]"
      >
        <div
          className="absolute inset-x-0 bottom-[-45%] top-[28%] origin-bottom [transform:rotateX(64deg)]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(247,246,238,0.3) 0 1px, transparent 1px 72px), repeating-linear-gradient(to bottom, rgba(247,246,238,0.3) 0 1px, transparent 1px 72px)",
            maskImage: "linear-gradient(to top, black, transparent)",
            WebkitMaskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-chassis-ink/45">
              the protocol
            </p>
            <h2 className="display mt-4 text-[clamp(2rem,4.6vw,3.4rem)] text-chassis-ink">
              Three moves,
              <br />
              no middleman.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-chassis-ink/60">
            A room is a rendezvous point, not a mailbox. Once the two browsers
            meet, our job is done and they talk without us.
          </p>
        </div>

        <ol className="mt-14 border-t border-white/15">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="grid gap-3 border-b border-white/15 py-8 sm:grid-cols-[3rem_1fr] lg:grid-cols-[4rem_1fr_1.15fr_auto] lg:items-start lg:gap-8"
            >
              <span className="font-mono text-[11px] text-chassis-ink/35">
                {step.number}
              </span>
              <h3 className="text-[21px] font-bold tracking-[-0.03em] text-chassis-ink sm:text-[24px]">
                {step.title}
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-chassis-ink/60">
                {step.body}
              </p>
              <div className="mt-1 justify-self-start lg:mt-1.5 lg:justify-self-end">
                {step.art}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-chassis-ink/40">
          <span className="flex items-center gap-2 text-chassis-ink/60">
            <ScanLine className="size-3.5" aria-hidden />
            any two devices
          </span>
          <span>laptop to phone</span>
          <span>phone to laptop</span>
          <span>laptop to laptop</span>
          <span>phone to phone</span>
        </div>
      </div>
    </section>
  );
}
