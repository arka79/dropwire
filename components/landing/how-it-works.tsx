import { QrCode, MousePointerClick, Share2 } from "lucide-react";
import { Reveal } from "@/components/reveal";

const STEPS = [
  {
    number: "01",
    icon: MousePointerClick,
    title: "Create a room",
    body: "One click gives you a short code and a shareable link. Rooms expire on their own.",
    art: (
      <span className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[13px] tracking-[0.18em] text-ink">
        NOVA-7K2P
      </span>
    ),
  },
  {
    number: "02",
    icon: Share2,
    title: "Share it",
    body: "Send the link, or let the other device scan the QR code. Nothing to install, no login.",
    art: (
      <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
        <QrCode className="size-4 text-ink-2" aria-hidden />
        scan to join
      </span>
    ),
  },
  {
    number: "03",
    icon: MousePointerClick,
    title: "Drop files",
    body: "Bytes travel on a direct connection between the two browsers. The server only handles the handshake.",
    art: (
      <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
        <span className="size-1.5 rounded-full bg-live" aria-hidden />
        direct · webrtc datachannel
      </span>
    ),
  },
];

export function SectionHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="label">{eyebrow}</p>
      <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.25rem)] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {lede ? (
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{lede}</p>
      ) : null}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="how it works"
            title="Three steps. No setup."
            lede="The whole product is one flow: make a room, share it, move bytes."
          />
        </Reveal>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 0.08} className="bg-surface">
              <li className="flex h-full flex-col gap-3 p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-ink-3">
                    {step.number}
                  </span>
                  <step.icon className="size-4 text-ink-3" aria-hidden />
                </div>
                <h3 className="text-base font-semibold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-2">{step.body}</p>
                <div className="mt-auto pt-4">{step.art}</div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.1}>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-5 py-4">
            <span className="label">cross device</span>
            {["laptop → phone", "phone → laptop", "laptop → laptop", "phone → phone"].map(
              (pair) => (
                <span
                  key={pair}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2"
                >
                  {pair}
                </span>
              ),
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
